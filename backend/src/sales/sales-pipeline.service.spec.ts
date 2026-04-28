import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SalesPipelineService } from './sales-pipeline.service';
import { Quotation } from './entities/quotation.entity';
import { Ddt } from './entities/ddt.entity';
import { ContactActivity } from './entities/contact-activity.entity';
import { Customer, SalesOrder, SalesOrderStatus } from './sales.entity';

/**
 * Sales pipeline projection — stage classification rules
 * (plan §31.1 Sprint 16 / S16.1).
 *
 * Tests the deterministic stage mapping against the real SalesPipelineService
 * with stub repositories that return pre-arranged rows. The repositories
 * mock the QueryBuilder chain only as far as `getMany()` / `getRawMany()`,
 * which is the surface the service actually consumes.
 */

interface QbStub<T> {
  where: () => QbStub<T>;
  andWhere: () => QbStub<T>;
  orderBy: () => QbStub<T>;
  addOrderBy: () => QbStub<T>;
  groupBy: () => QbStub<T>;
  select: () => QbStub<T>;
  addSelect: () => QbStub<T>;
  getMany: () => Promise<T[]>;
  getRawMany: () => Promise<unknown[]>;
}

function qb<T>(rows: T[], rawRows: unknown[] = []): QbStub<T> {
  const stub: QbStub<T> = {
    where: () => stub,
    andWhere: () => stub,
    orderBy: () => stub,
    addOrderBy: () => stub,
    groupBy: () => stub,
    select: () => stub,
    addSelect: () => stub,
    getMany: async () => rows,
    getRawMany: async () => rawRows,
  };
  return stub;
}

const TENANT = '11111111-1111-1111-1111-111111111111';
const CUSTOMER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CUSTOMER_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CUSTOMER_C = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const CUSTOMER_LEAD = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

function customer(id: string, code: string, name: string): Customer {
  return {
    id,
    tenantId: TENANT,
    code,
    name,
    salesOrders: [],
    isActive: true,
  } as unknown as Customer;
}

function quotation(
  customerId: string,
  status: Quotation['status'],
  overrides: Partial<Quotation> = {},
): Quotation {
  return {
    id: `q-${customerId.slice(0, 8)}-${status}`,
    tenantId: TENANT,
    quotationNumber: `Q-${status.toUpperCase()}`,
    customerId,
    issueDate: new Date('2026-04-15'),
    validUntilDate: new Date('2026-05-15'),
    status,
    subtotalCents: 100_000,
    taxCents: 22_000,
    totalCents: 122_000,
    currency: 'EUR',
    notes: null,
    sentAt: null,
    acceptedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    convertedToSalesOrderId: null,
    lines: [],
    createdAt: new Date('2026-04-15T08:00:00Z'),
    updatedAt: new Date('2026-04-20T10:00:00Z'),
    ...overrides,
  } as unknown as Quotation;
}

function buildService(
  quotations: Quotation[],
  customers: Customer[],
  salesOrders: SalesOrder[],
  activities: { customerId: string; lastActivityAt: Date | string }[],
): Promise<SalesPipelineService> {
  return Test.createTestingModule({
    providers: [
      SalesPipelineService,
      {
        provide: getRepositoryToken(Quotation),
        useValue: { createQueryBuilder: () => qb(quotations) },
      },
      {
        provide: getRepositoryToken(SalesOrder),
        useValue: { createQueryBuilder: () => qb(salesOrders) },
      },
      {
        provide: getRepositoryToken(Customer),
        useValue: { createQueryBuilder: () => qb(customers) },
      },
      {
        provide: getRepositoryToken(Ddt),
        useValue: { createQueryBuilder: () => qb<Ddt>([]) },
      },
      {
        provide: getRepositoryToken(ContactActivity),
        useValue: { createQueryBuilder: () => qb<ContactActivity>([], activities) },
      },
    ],
  })
    .compile()
    .then((m) => m.get(SalesPipelineService));
}

describe('SalesPipelineService — stage classification (S16.1)', () => {
  const customers = [
    customer(CUSTOMER_A, 'C-A', 'Cliente A srl'),
    customer(CUSTOMER_B, 'C-B', 'Cliente B srl'),
    customer(CUSTOMER_C, 'C-C', 'Cliente C srl'),
    customer(CUSTOMER_LEAD, 'C-LEAD', 'Cliente Lead srl'),
  ];

  it('maps quotation status → pipeline stage deterministically', async () => {
    const draft = quotation(CUSTOMER_A, 'draft');
    const sent = quotation(CUSTOMER_B, 'sent');
    const revised = quotation(CUSTOMER_C, 'revised');

    const svc = await buildService([draft, sent, revised], customers, [], [
      { customerId: CUSTOMER_LEAD, lastActivityAt: new Date() },
    ]);

    const snap = await svc.getPipeline(TENANT);
    const byCustomer = new Map(snap.deals.map((d) => [d.customerId, d]));

    expect(byCustomer.get(CUSTOMER_A)?.stage).toBe('qualifying');
    expect(byCustomer.get(CUSTOMER_B)?.stage).toBe('qualifying');
    expect(byCustomer.get(CUSTOMER_C)?.stage).toBe('negotiation');
    expect(byCustomer.get(CUSTOMER_LEAD)?.stage).toBe('lead');
  });

  it('classifies converted quotation linked to a shipped SalesOrder as delivered', async () => {
    const soId = 'so-001';
    const so = {
      id: soId,
      tenantId: TENANT,
      customerId: CUSTOMER_A,
      orderNumber: 'SO-2026-0001',
      status: SalesOrderStatus.SHIPPED,
      totalAmount: 1234,
      createdAt: new Date('2026-04-25T10:00:00Z'),
      updatedAt: new Date('2026-04-25T10:00:00Z'),
    } as unknown as SalesOrder;

    const q = quotation(CUSTOMER_A, 'converted', {
      convertedToSalesOrderId: soId,
    });

    const svc = await buildService(
      [q],
      [customer(CUSTOMER_A, 'C-A', 'Cliente A srl')],
      [so],
      [],
    );

    const snap = await svc.getPipeline(TENANT);
    expect(snap.deals).toHaveLength(1);
    expect(snap.deals[0].stage).toBe('delivered');
    expect(snap.deals[0].salesOrderNumber).toBe('SO-2026-0001');
  });

  it('classifies converted quotation linked to a confirmed SalesOrder as won', async () => {
    const soId = 'so-002';
    const so = {
      id: soId,
      tenantId: TENANT,
      customerId: CUSTOMER_A,
      orderNumber: 'SO-2026-0002',
      status: SalesOrderStatus.CONFIRMED,
      totalAmount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as SalesOrder;

    const q = quotation(CUSTOMER_A, 'converted', {
      convertedToSalesOrderId: soId,
    });

    const svc = await buildService(
      [q],
      [customer(CUSTOMER_A, 'C-A', 'Cliente A srl')],
      [so],
      [],
    );

    const snap = await svc.getPipeline(TENANT);
    expect(snap.deals[0].stage).toBe('won');
  });

  it('drops rejected/expired quotations older than 90 days from the lost bucket', async () => {
    const old = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
    const fresh = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const oldRejected = quotation(CUSTOMER_A, 'rejected', {
      updatedAt: old,
    });
    const freshExpired = quotation(CUSTOMER_B, 'expired', {
      updatedAt: fresh,
    });

    const svc = await buildService(
      [oldRejected, freshExpired],
      [
        customer(CUSTOMER_A, 'C-A', 'Cliente A srl'),
        customer(CUSTOMER_B, 'C-B', 'Cliente B srl'),
      ],
      [],
      [],
    );

    const snap = await svc.getPipeline(TENANT);
    expect(snap.deals.find((d) => d.customerId === CUSTOMER_A)).toBeUndefined();
    expect(snap.deals.find((d) => d.customerId === CUSTOMER_B)?.stage).toBe(
      'lost',
    );
  });

  it('totals by stage match per-deal sums (R-D04: bigint cents only)', async () => {
    const a = quotation(CUSTOMER_A, 'sent', { totalCents: 500_00 });
    const b = quotation(CUSTOMER_B, 'sent', { totalCents: 1_000_00 });

    const svc = await buildService(
      [a, b],
      [
        customer(CUSTOMER_A, 'C-A', 'Cliente A srl'),
        customer(CUSTOMER_B, 'C-B', 'Cliente B srl'),
      ],
      [],
      [],
    );

    const snap = await svc.getPipeline(TENANT);
    expect(snap.totalsByStage.qualifying.count).toBe(2);
    expect(snap.totalsByStage.qualifying.valueCents).toBe(150_000);
  });

  it('respects stage filter', async () => {
    const a = quotation(CUSTOMER_A, 'sent');
    const b = quotation(CUSTOMER_B, 'revised');

    const svc = await buildService(
      [a, b],
      [
        customer(CUSTOMER_A, 'C-A', 'Cliente A srl'),
        customer(CUSTOMER_B, 'C-B', 'Cliente B srl'),
      ],
      [],
      [],
    );

    const snap = await svc.getPipeline(TENANT, { stage: ['negotiation'] });
    expect(snap.deals).toHaveLength(1);
    expect(snap.deals[0].stage).toBe('negotiation');
    expect(snap.deals[0].customerId).toBe(CUSTOMER_B);
  });
});
