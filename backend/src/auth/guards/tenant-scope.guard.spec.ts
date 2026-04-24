import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantScopeGuard } from './tenant-scope.guard';

function makeCtx(req: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
}

describe('TenantScopeGuard', () => {
  const guard = new TenantScopeGuard();

  it('allows when no user on request (other guards will reject)', () => {
    expect(guard.canActivate(makeCtx({}))).toBe(true);
  });

  it('allows when body/query/header/params carry matching tenantId', () => {
    const req = {
      user: { tenantId: 'abc' },
      header: (k: string) => (k === 'x-tenant-id' ? 'abc' : null),
      query: { tenantId: 'abc' },
      params: {},
      body: { tenantId: 'abc' },
      method: 'POST',
      originalUrl: '/api/sales/orders',
    };
    expect(guard.canActivate(makeCtx(req))).toBe(true);
  });

  it('throws ForbiddenException when header tenant mismatches', () => {
    const req = {
      user: { tenantId: 'abc' },
      header: (k: string) => (k === 'x-tenant-id' ? 'other' : null),
      query: {},
      params: {},
      body: {},
      method: 'GET',
      originalUrl: '/api/sales/orders',
    };
    expect(() => guard.canActivate(makeCtx(req))).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException on body tenant mismatch', () => {
    const req = {
      user: { tenantId: 'abc' },
      header: () => null,
      query: {},
      params: {},
      body: { tenantId: 'evil' },
      method: 'POST',
      originalUrl: '/api/sales/orders',
    };
    expect(() => guard.canActivate(makeCtx(req))).toThrow(/Cross-tenant/);
  });

  it('accepts snake_case tenant_id alias', () => {
    const req = {
      user: { tenantId: 'abc' },
      header: () => null,
      query: { tenant_id: 'abc' },
      params: { tenant_id: 'abc' },
      body: {},
      method: 'GET',
      originalUrl: '/api/sales/orders',
    };
    expect(guard.canActivate(makeCtx(req))).toBe(true);
  });

  it('rejects when ANY of the claimed places mismatches even if others match', () => {
    const req = {
      user: { tenantId: 'abc' },
      header: (k: string) => (k === 'x-tenant-id' ? 'abc' : null),
      query: { tenantId: 'abc' },
      params: { tenantId: 'abc' },
      body: { tenantId: 'evil' },
      method: 'PATCH',
      originalUrl: '/api/sales/orders/123',
    };
    expect(() => guard.canActivate(makeCtx(req))).toThrow(ForbiddenException);
  });
});
