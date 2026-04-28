import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { CommercialistaService } from './commercialista.service';
import { Membership } from '../memberships/membership.entity';
import { Tenant } from '../tenants/tenant.entity';
import { Invoice } from '../accounting/accounting.entity';
import { SupplierInvoice } from '../procurement/entities/supplier-invoice.entity';
import { IntrastatDeclaration } from '../intrastat/entities/intrastat-declaration.entity';
import { Quotation } from '../sales/entities/quotation.entity';

const USER_A = '11111111-1111-1111-1111-111111111111';
const TENANT_X = '22222222-2222-2222-2222-222222222222';

interface QbStub<T> {
  where: () => QbStub<T>;
  andWhere: () => QbStub<T>;
  orderBy: () => QbStub<T>;
  addOrderBy: () => QbStub<T>;
  limit: () => QbStub<T>;
  getMany: () => Promise<T[]>;
  getOne: () => Promise<T | null>;
}

function qb<T>(rows: T[]): QbStub<T> {
  const stub: QbStub<T> = {
    where: () => stub,
    andWhere: () => stub,
    orderBy: () => stub,
    addOrderBy: () => stub,
    limit: () => stub,
    getMany: async () => rows,
    getOne: async () => rows[0] ?? null,
  };
  return stub;
}

async function build(state: {
  memberships?: Membership[];
  tenants?: Tenant[];
  invoices?: Invoice[];
  supplierInvoices?: SupplierInvoice[];
  intrastat?: IntrastatDeclaration[];
  quotations?: Quotation[];
}) {
  const data = state.memberships ?? [];
  const membershipRepo = {
    find: async ({ where }: { where: Partial<Membership> }) =>
      data.filter((m) =>
        Object.entries(where ?? {}).every(
          ([k, v]) => (m as unknown as Record<string, unknown>)[k] === v,
        ),
      ),
    findOne: async ({ where }: { where: Partial<Membership> }) =>
      data.find((m) =>
        Object.entries(where ?? {}).every(
          ([k, v]) => (m as unknown as Record<string, unknown>)[k] === v,
        ),
      ) ?? null,
  };
  const tenantRepo = {
    createQueryBuilder: () => qb(state.tenants ?? []),
  };

  const module = await Test.createTestingModule({
    providers: [
      CommercialistaService,
      { provide: getRepositoryToken(Membership), useValue: membershipRepo },
      { provide: getRepositoryToken(Tenant), useValue: tenantRepo },
      {
        provide: getRepositoryToken(Invoice),
        useValue: { createQueryBuilder: () => qb(state.invoices ?? []) },
      },
      {
        provide: getRepositoryToken(SupplierInvoice),
        useValue: {
          createQueryBuilder: () => qb(state.supplierInvoices ?? []),
        },
      },
      {
        provide: getRepositoryToken(IntrastatDeclaration),
        useValue: { createQueryBuilder: () => qb(state.intrastat ?? []) },
      },
      {
        provide: getRepositoryToken(Quotation),
        useValue: { createQueryBuilder: () => qb(state.quotations ?? []) },
      },
    ],
  }).compile();
  return module.get(CommercialistaService);
}

describe('CommercialistaService — membership gate (S16.3)', () => {
  it('rejects users without a commercialista membership', async () => {
    const svc = await build({ memberships: [] });
    await expect(svc.getSnapshot(USER_A, TENANT_X)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects pending memberships', async () => {
    const m: Membership = {
      id: 'm1',
      tenantId: TENANT_X,
      userId: USER_A,
      role: 'commercialista',
      status: 'pending',
      invitedAt: null,
      consentedAt: null,
      grantedAt: null,
      revokedAt: null,
      invitedBy: null,
      revokedBy: null,
      scopes: [],
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const svc = await build({ memberships: [m] });
    await expect(svc.getSnapshot(USER_A, TENANT_X)).rejects.toThrow(
      /not active/,
    );
  });

  it('returns aggregated snapshot when membership is active', async () => {
    const m: Membership = {
      id: 'm1',
      tenantId: TENANT_X,
      userId: USER_A,
      role: 'commercialista',
      status: 'active',
      invitedAt: null,
      consentedAt: new Date(),
      grantedAt: new Date(),
      revokedAt: null,
      invitedBy: null,
      revokedBy: null,
      scopes: [],
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const tenant: Tenant = {
      id: TENANT_X,
      name: 'Acme Spa',
      plan: 'professionale',
      status: 'active',
    } as unknown as Tenant;
    const svc = await build({
      memberships: [m],
      tenants: [tenant],
      invoices: [
        {
          id: 'i1',
          tenantId: TENANT_X,
          status: 'submitted',
          taxAmount: 100.5,
          invoiceDate: new Date(),
        } as unknown as Invoice,
      ],
      supplierInvoices: [
        {
          id: 'si1',
          tenantId: TENANT_X,
          status: 'matched',
          taxCents: 5000,
          supplierInvoiceDate: new Date(),
        } as unknown as SupplierInvoice,
      ],
      intrastat: [
        {
          id: 'd1',
          tenantId: TENANT_X,
          type: 'cessioni',
          periodYear: 2026,
          periodMonth: 4,
          status: 'generated',
          lineCount: 3,
          totalValueCents: 50000,
        } as unknown as IntrastatDeclaration,
      ],
      quotations: [
        {
          id: 'q1',
          tenantId: TENANT_X,
          status: 'sent',
        } as unknown as Quotation,
      ],
    });

    const snap = await svc.getSnapshot(USER_A, TENANT_X);
    expect(snap.tenant.name).toBe('Acme Spa');
    expect(snap.invoiceStatusCounts.submitted).toBe(1);
    expect(snap.supplierInvoiceStatusCounts.matched).toBe(1);
    expect(snap.recentIntrastat[0].type).toBe('cessioni');
    expect(snap.pipelineQuotationCounts.sent).toBe(1);
    expect(snap.deadlines).toHaveLength(1);
    expect(snap.deadlines[0].kind).toBe('iva_mensile');
  });
});
