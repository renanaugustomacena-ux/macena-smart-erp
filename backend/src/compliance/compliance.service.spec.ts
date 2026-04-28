import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ComplianceService } from './compliance.service';
import { Tenant } from '../tenants/tenant.entity';
import { AuditLog } from '../audit/audit-log.entity';

const TENANT = '11111111-1111-1111-1111-111111111111';

interface QbStub<T> {
  where: () => QbStub<T>;
  andWhere: () => QbStub<T>;
  orderBy: () => QbStub<T>;
  limit: () => QbStub<T>;
  getMany: () => Promise<T[]>;
}

function qb<T>(rows: T[]): QbStub<T> {
  const stub: QbStub<T> = {
    where: () => stub,
    andWhere: () => stub,
    orderBy: () => stub,
    limit: () => stub,
    getMany: async () => rows,
  };
  return stub;
}

describe('ComplianceService — NIS2 + audit (S20.1, S20.4, S20.5)', () => {
  it('generates a self-contained PDF 1.4 NIS2 pack', async () => {
    const tenantRepo = {
      findOne: async () =>
        ({
          id: TENANT,
          name: 'Acme Spa',
          plan: 'professionale',
        }) as unknown as Tenant,
    };
    const auditRepo = {
      createQueryBuilder: () => qb<AuditLog>([]),
    };
    const module = await Test.createTestingModule({
      providers: [
        ComplianceService,
        { provide: getRepositoryToken(Tenant), useValue: tenantRepo },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
      ],
    }).compile();
    const svc = module.get(ComplianceService);

    const out = await svc.generateNis2Pack(TENANT);
    expect(out.filename).toContain('nis2-compliance-pack');
    expect(out.contentType).toBe('application/pdf');
    expect(out.body.subarray(0, 8).toString('latin1')).toMatch(/^%PDF-1\.4/);
    expect(out.body.subarray(-6).toString('latin1')).toContain('%%EOF');
  });

  it('security pack reuses the NIS2 renderer with a different filename', async () => {
    const tenantRepo = {
      findOne: async () =>
        ({
          id: TENANT,
          name: 'Acme Spa',
          plan: 'enterprise',
        }) as unknown as Tenant,
    };
    const auditRepo = {
      createQueryBuilder: () => qb<AuditLog>([]),
    };
    const module = await Test.createTestingModule({
      providers: [
        ComplianceService,
        { provide: getRepositoryToken(Tenant), useValue: tenantRepo },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
      ],
    }).compile();
    const svc = module.get(ComplianceService);
    const out = await svc.generateSecurityPack(TENANT);
    expect(out.filename).toContain('security-pack');
    expect(out.contentType).toBe('application/pdf');
  });

  it('listAuditTrail filters by tenantId + action + outcome', async () => {
    const fakeRows = [
      { id: 'a1', tenantId: TENANT, action: 'invoice.create', outcome: 'success' },
    ] as unknown as AuditLog[];
    const tenantRepo = { findOne: async () => null };
    const auditRepo = {
      createQueryBuilder: () => qb(fakeRows),
    };
    const module = await Test.createTestingModule({
      providers: [
        ComplianceService,
        { provide: getRepositoryToken(Tenant), useValue: tenantRepo },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
      ],
    }).compile();
    const svc = module.get(ComplianceService);
    const rows = await svc.listAuditTrail(TENANT, {
      action: 'invoice.create',
      outcome: 'success',
      limit: 50,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('invoice.create');
  });
});
