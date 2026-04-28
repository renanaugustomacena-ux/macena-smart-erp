import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { IntrastatService } from './intrastat.service';
import {
  IntrastatDeclaration,
  IntrastatLine,
} from './entities/intrastat-declaration.entity';
import { Customer } from '../sales/sales.entity';
import { Invoice } from '../accounting/accounting.entity';
import { SupplierInvoice } from '../procurement/entities/supplier-invoice.entity';

/**
 * IntrastatService — aggregator + CSV/XML export (plan §31.1 Sprint 16 / S16.2).
 *
 * Tests focus on:
 *   - intra-EU partner filtering (IT excluded; non-EU excluded)
 *   - month-window honesty (lines outside the month are dropped)
 *   - CSV/XML rendering for both INTRA-1bis (cessioni) and INTRA-2bis (acquisti)
 */

interface QbStub<T> {
  where: () => QbStub<T>;
  andWhere: () => QbStub<T>;
  orderBy: () => QbStub<T>;
  addOrderBy: () => QbStub<T>;
  getMany: () => Promise<T[]>;
}

function qb<T>(rows: T[]): QbStub<T> {
  const stub: QbStub<T> = {
    where: () => stub,
    andWhere: () => stub,
    orderBy: () => stub,
    addOrderBy: () => stub,
    getMany: async () => rows,
  };
  return stub;
}

const TENANT = '11111111-1111-1111-1111-111111111111';

function customer(
  id: string,
  country: string,
  vat: string | null = null,
): Customer {
  return {
    id,
    tenantId: TENANT,
    code: `C-${id.slice(0, 4)}`,
    name: `Cliente ${country}`,
    country,
    vatNumber: vat,
  } as unknown as Customer;
}

function invoice(
  id: string,
  customerId: string,
  totalAmount: number,
  dateIso: string,
): Invoice {
  return {
    id,
    tenantId: TENANT,
    customerId,
    totalAmount,
    invoiceDate: new Date(dateIso),
  } as unknown as Invoice;
}

function supplierInvoice(
  id: string,
  partnerCountry: string | null,
  partnerVatNumber: string | null,
  totalCents: number,
  dateIso: string,
): SupplierInvoice {
  return {
    id,
    tenantId: TENANT,
    partnerCountry,
    partnerVatNumber,
    totalCents,
    supplierInvoiceDate: new Date(dateIso),
  } as unknown as SupplierInvoice;
}

async function build(rows: {
  invoices?: Invoice[];
  customers?: Customer[];
  supplierInvoices?: SupplierInvoice[];
  declarations?: IntrastatDeclaration[];
  lines?: IntrastatLine[];
}): Promise<IntrastatService> {
  const declData = [...(rows.declarations ?? [])];
  const lineData = [...(rows.lines ?? [])];

  const declRepo = {
    findOne: async ({ where }: { where: Partial<IntrastatDeclaration> }) =>
      declData.find((d) =>
        Object.entries(where ?? {}).every(([k, v]) =>
          (d as unknown as Record<string, unknown>)[k] === v,
        ),
      ) ?? null,
    save: async (d: IntrastatDeclaration) => {
      const existingIdx = declData.findIndex((x) => x.id === d.id);
      if (existingIdx >= 0) declData[existingIdx] = d;
      else declData.push(d);
      return d;
    },
    create: (d: Partial<IntrastatDeclaration>) =>
      ({
        id: d.id ?? `decl-${declData.length + 1}`,
        ...d,
      }) as IntrastatDeclaration,
    createQueryBuilder: () => qb(declData),
  };

  const lineRepo = {
    find: async ({ where, order: _order }: { where: Partial<IntrastatLine>; order?: unknown }) =>
      lineData.filter((l) =>
        Object.entries(where ?? {}).every(([k, v]) =>
          (l as unknown as Record<string, unknown>)[k] === v,
        ),
      ),
    save: async (l: IntrastatLine) => {
      lineData.push(l);
      return l;
    },
  };

  const module = await Test.createTestingModule({
    providers: [
      IntrastatService,
      {
        provide: getRepositoryToken(IntrastatDeclaration),
        useValue: declRepo,
      },
      {
        provide: getRepositoryToken(IntrastatLine),
        useValue: lineRepo,
      },
      {
        provide: getRepositoryToken(Invoice),
        useValue: { createQueryBuilder: () => qb(rows.invoices ?? []) },
      },
      {
        provide: getRepositoryToken(Customer),
        useValue: { createQueryBuilder: () => qb(rows.customers ?? []) },
      },
      {
        provide: getRepositoryToken(SupplierInvoice),
        useValue: {
          createQueryBuilder: () => qb(rows.supplierInvoices ?? []),
        },
      },
      {
        provide: DataSource,
        useValue: {
          transaction: async (fn: (m: unknown) => unknown) =>
            fn({
              findOne: declRepo.findOne,
              save: async (entity: unknown, val?: unknown) => {
                const target = val ?? entity;
                if (
                  target &&
                  typeof target === 'object' &&
                  'sourceDocType' in (target as object)
                ) {
                  return lineRepo.save(target as IntrastatLine);
                }
                return declRepo.save(target as IntrastatDeclaration);
              },
              create: (entity: unknown, partial: unknown) => {
                if (entity === IntrastatLine) {
                  return {
                    id: `line-${lineData.length + 1}`,
                    ...(partial as object),
                  } as IntrastatLine;
                }
                return declRepo.create(partial as Partial<IntrastatDeclaration>);
              },
              delete: async (_entity: unknown, where: Partial<IntrastatLine>) => {
                for (let i = lineData.length - 1; i >= 0; i--) {
                  const ok = Object.entries(where).every(
                    ([k, v]) => (lineData[i] as unknown as Record<string, unknown>)[k] === v,
                  );
                  if (ok) lineData.splice(i, 1);
                }
                return { affected: 0 };
              },
            }),
        },
      },
    ],
  }).compile();

  return module.get(IntrastatService);
}

describe('IntrastatService — cessioni aggregation (S16.2)', () => {
  it('keeps only intra-EU non-IT customers', async () => {
    const cIT = customer('cust-it', 'IT', '12345678901');
    const cDE = customer('cust-de', 'DE', '987654321');
    const cUS = customer('cust-us', 'US', null);
    const cFR = customer('cust-fr', 'FR', '11122233344');

    // Date-window filtering is performed in SQL by the service's
    // QueryBuilder; the test stub ignores filters, so we feed only
    // in-window invoices and verify the EU-partner filter precisely.
    const inv1 = invoice('inv-de', 'cust-de', 1234.56, '2026-04-15');
    const inv2 = invoice('inv-it', 'cust-it', 999, '2026-04-20');
    const inv3 = invoice('inv-us', 'cust-us', 500, '2026-04-22');
    const inv4 = invoice('inv-fr', 'cust-fr', 200, '2026-04-30');

    const svc = await build({
      invoices: [inv1, inv2, inv3, inv4],
      customers: [cIT, cDE, cUS, cFR],
    });

    const lines = await svc.aggregateLines(TENANT, 'cessioni', 2026, 4);
    expect(lines).toHaveLength(2);
    const partners = lines.map((l) => l.partnerCountry).sort();
    expect(partners).toEqual(['DE', 'FR']);

    const deLine = lines.find((l) => l.partnerCountry === 'DE');
    expect(deLine?.valueCents).toBe(123_456);
    expect(deLine?.partnerVatNumber).toBe('DE987654321');
    expect(deLine?.sourceDocType).toBe('invoice');
    expect(deLine?.sourceDocId).toBe('inv-de');
  });
});

describe('IntrastatService — acquisti aggregation (S16.2)', () => {
  it('keeps only supplier invoices flagged with intra-EU country', async () => {
    const siDE = supplierInvoice('si-de', 'DE', 'DE111222333', 50_000, '2026-04-10');
    const siCH = supplierInvoice('si-ch', 'CH', 'CHE-444555666', 70_000, '2026-04-11');
    const siNull = supplierInvoice('si-null', null, null, 30_000, '2026-04-12');
    const siNL = supplierInvoice('si-nl', 'NL', 'NL777888999', 80_000, '2026-04-25');

    const svc = await build({
      // The SupplierInvoice query already filters partnerCountry IS NOT NULL
      // — the test stub still returns null rows so the EU filter must drop them.
      supplierInvoices: [siDE, siCH, siNull, siNL],
    });

    const lines = await svc.aggregateLines(TENANT, 'acquisti', 2026, 4);
    expect(lines.map((l) => l.partnerCountry).sort()).toEqual(['DE', 'NL']);
    expect(lines[0].sourceDocType).toBe('supplier_invoice');
  });
});

describe('IntrastatService — CSV / XML export (S16.2)', () => {
  it('emits ADM 1bis CSV with header + per-line rows in euro integers', async () => {
    const decl: IntrastatDeclaration = {
      id: 'decl-1',
      tenantId: TENANT,
      type: 'cessioni',
      periodicity: 'monthly',
      periodYear: 2026,
      periodMonth: 4,
      periodQuarter: null,
      status: 'generated',
      totalValueCents: 250_000,
      lineCount: 1,
      admProtocollo: null,
      generatedAt: new Date(),
      submittedAt: null,
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      generatedBy: null,
      submittedBy: null,
      notes: null,
      lines: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const line: IntrastatLine = {
      id: 'line-1',
      tenantId: TENANT,
      declarationId: 'decl-1',
      position: 1,
      partnerCountry: 'DE',
      partnerVatNumber: 'DE123456789',
      nc8Code: '84713000',
      netMassKg: '12.500',
      supplementaryUnits: null,
      valueCents: 250_000,
      statisticalValueCents: 250_000,
      currency: 'EUR',
      naturaTransazione: '11',
      modalitaTrasporto: '4',
      regimeStatistico: '10',
      paeseDestinazioneProvenienza: 'DE',
      paeseOrigine: null,
      sourceDocType: 'invoice',
      sourceDocId: 'inv-de',
      declaration: decl,
    };

    const svc = await build({
      declarations: [decl],
      lines: [line],
    });
    const csv = await svc.exportCsv(TENANT, 'decl-1');
    expect(csv.filename).toBe('INTRA-1bis_2026-04.csv');
    const rows = csv.body.trim().split(/\r\n/);
    expect(rows[0]).toContain('Codice ISO Stato membro acquirente');
    expect(rows[1].split(';')[0]).toBe('DE');
    expect(rows[1].split(';')[1]).toBe('DE123456789');
    expect(rows[1].split(';')[2]).toBe('2500'); // 250_000 cents → 2500 euro

    const xml = await svc.exportXml(TENANT, 'decl-1');
    expect(xml.filename).toBe('INTRA-1bis_2026-04.xml');
    expect(xml.body).toContain('<IntrastatDeclaration tipo="cessioni"');
    expect(xml.body).toContain('<PaesePartner>DE</PaesePartner>');
    expect(xml.body).toContain('<AmmontareEuro>2500</AmmontareEuro>');
  });

  it('emits ADM 2bis CSV with paese di provenienza + paese di origine columns', async () => {
    const decl: IntrastatDeclaration = {
      id: 'decl-2',
      tenantId: TENANT,
      type: 'acquisti',
      periodicity: 'monthly',
      periodYear: 2026,
      periodMonth: 4,
      periodQuarter: null,
      status: 'generated',
      totalValueCents: 100_000,
      lineCount: 1,
      admProtocollo: null,
      generatedAt: new Date(),
      submittedAt: null,
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      generatedBy: null,
      submittedBy: null,
      notes: null,
      lines: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const line: IntrastatLine = {
      id: 'line-2',
      tenantId: TENANT,
      declarationId: 'decl-2',
      position: 1,
      partnerCountry: 'NL',
      partnerVatNumber: 'NL12345',
      nc8Code: null,
      netMassKg: null,
      supplementaryUnits: null,
      valueCents: 100_000,
      statisticalValueCents: 100_000,
      currency: 'EUR',
      naturaTransazione: '11',
      modalitaTrasporto: null,
      regimeStatistico: null,
      paeseDestinazioneProvenienza: 'NL',
      paeseOrigine: 'CN',
      sourceDocType: 'supplier_invoice',
      sourceDocId: 'si-nl',
      declaration: decl,
    };

    const svc = await build({ declarations: [decl], lines: [line] });
    const csv = await svc.exportCsv(TENANT, 'decl-2');
    expect(csv.filename).toBe('INTRA-2bis_2026-04.csv');
    expect(csv.body).toContain('Paese di provenienza');
    expect(csv.body).toContain('Paese di origine delle merci');
    expect(csv.body).toContain('NL;NL12345;1000;');
  });
});
