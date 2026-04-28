import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { MembershipsService } from './memberships.service';
import { Membership } from './membership.entity';
import { Tenant } from '../tenants/tenant.entity';
import { AuthService, User, UserRole } from '../auth/auth.service';

/**
 * MembershipsService — invariants under the Andrea pattern (S16.3).
 *
 * Tests confirm:
 *   - listMine returns memberships for the calling user only
 *   - switchTenant rejects non-active memberships
 *   - revoke is restricted to the subject or the tenant admin
 *   - consent is restricted to the subject
 */

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';
const TENANT_X = '33333333-3333-3333-3333-333333333333';
const TENANT_Y = '44444444-4444-4444-4444-444444444444';

function membership(
  id: string,
  userId: string,
  tenantId: string,
  status: Membership['status'],
  role: Membership['role'] = 'commercialista',
): Membership {
  return {
    id,
    userId,
    tenantId,
    status,
    role,
    invitedAt: new Date('2026-01-01'),
    consentedAt: status === 'active' ? new Date('2026-01-02') : null,
    grantedAt: status === 'active' ? new Date('2026-01-02') : null,
    revokedAt: status === 'revoked' ? new Date('2026-01-10') : null,
    invitedBy: USER_B,
    revokedBy: null,
    scopes: [],
    notes: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
  };
}

interface QbStub<T> {
  where: () => QbStub<T>;
  andWhere: () => QbStub<T>;
  orderBy: () => QbStub<T>;
  addOrderBy: () => QbStub<T>;
  getMany: () => Promise<T[]>;
  getOne: () => Promise<T | null>;
}

function qb<T>(rows: T[]): QbStub<T> {
  const stub: QbStub<T> = {
    where: () => stub,
    andWhere: () => stub,
    orderBy: () => stub,
    addOrderBy: () => stub,
    getMany: async () => rows,
    getOne: async () => rows[0] ?? null,
  };
  return stub;
}

async function build(state: {
  memberships?: Membership[];
  tenants?: Tenant[];
}) {
  const data = [...(state.memberships ?? [])];
  const tenants = [...(state.tenants ?? [])];

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
    save: async (m: Membership) => {
      const i = data.findIndex((x) => x.id === m.id);
      if (i >= 0) data[i] = m;
      else data.push(m);
      return m;
    },
    create: (partial: Partial<Membership>) =>
      ({
        id: `m-${data.length + 1}`,
        scopes: [],
        ...partial,
      }) as Membership,
    createQueryBuilder: () => qb(data),
  };

  const tenantRepo = {
    createQueryBuilder: () => qb(tenants),
  };

  const userRepo = {};

  const authMock = {
    mintTokensForTenantSwitch: jest
      .fn()
      .mockResolvedValue({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 }),
  };

  const module = await Test.createTestingModule({
    providers: [
      MembershipsService,
      {
        provide: getRepositoryToken(Membership),
        useValue: membershipRepo,
      },
      {
        provide: getRepositoryToken(Tenant),
        useValue: tenantRepo,
      },
      {
        provide: getRepositoryToken(User),
        useValue: userRepo,
      },
      {
        provide: AuthService,
        useValue: authMock,
      },
    ],
  }).compile();

  return { svc: module.get(MembershipsService), authMock, data };
}

describe('MembershipsService.listMine', () => {
  it('lists memberships scoped to caller', async () => {
    const m1 = membership('m1', USER_A, TENANT_X, 'active');
    const m2 = membership('m2', USER_B, TENANT_X, 'active');
    const tenants = [
      { id: TENANT_X, name: 'Tenant X', plan: 'base', status: 'active' },
    ] as unknown as Tenant[];

    const { svc } = await build({ memberships: [m1, m2], tenants });
    const list = await svc.listMine(USER_A);
    expect(list).toHaveLength(1);
    expect(list[0].tenant.name).toBe('Tenant X');
  });
});

describe('MembershipsService.switchTenant', () => {
  it('refuses non-active membership', async () => {
    const m = membership('m1', USER_A, TENANT_X, 'pending');
    const { svc } = await build({ memberships: [m] });
    await expect(svc.switchTenant(USER_A, TENANT_X)).rejects.toThrow(
      /not active/,
    );
  });

  it('mints fresh tokens with the membership role', async () => {
    const m = membership('m1', USER_A, TENANT_X, 'active');
    const { svc, authMock } = await build({ memberships: [m] });
    const result = await svc.switchTenant(USER_A, TENANT_X);
    expect(authMock.mintTokensForTenantSwitch).toHaveBeenCalledWith(
      USER_A,
      TENANT_X,
      UserRole.VIEWER, // commercialista → VIEWER for legacy RBAC
    );
    expect(result.accessToken).toBe('a');
  });
});

describe('MembershipsService.revoke', () => {
  it('lets the subject revoke own membership', async () => {
    const m = membership('m1', USER_A, TENANT_X, 'active');
    const { svc } = await build({ memberships: [m] });
    const out = await svc.revoke('m1', USER_A, 'viewer', TENANT_Y);
    expect(out.status).toBe('revoked');
  });

  it('lets the tenant admin revoke memberships into their tenant', async () => {
    const m = membership('m1', USER_A, TENANT_X, 'active');
    const { svc } = await build({ memberships: [m] });
    const out = await svc.revoke('m1', USER_B, UserRole.ADMIN, TENANT_X);
    expect(out.status).toBe('revoked');
  });

  it('refuses unrelated user', async () => {
    const m = membership('m1', USER_A, TENANT_X, 'active');
    const { svc } = await build({ memberships: [m] });
    await expect(
      svc.revoke('m1', USER_B, 'viewer', TENANT_Y),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('MembershipsService.consent', () => {
  it('lets the subject move pending → active', async () => {
    const m = membership('m1', USER_A, TENANT_X, 'pending');
    const { svc } = await build({ memberships: [m] });
    const out = await svc.consent('m1', USER_A);
    expect(out.status).toBe('active');
    expect(out.consentedAt).toBeInstanceOf(Date);
  });

  it('refuses non-subject', async () => {
    const m = membership('m1', USER_A, TENANT_X, 'pending');
    const { svc } = await build({ memberships: [m] });
    await expect(svc.consent('m1', USER_B)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
