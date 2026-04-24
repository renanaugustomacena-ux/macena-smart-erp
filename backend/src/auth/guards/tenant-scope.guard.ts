import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * TenantScopeGuard — enforces that every authenticated request's JWT
 * `tenantId` claim agrees with any `tenantId` expressed through the URL
 * path, query parameters, request body, or `X-Tenant-ID` header.
 *
 * A mismatch indicates an attempt to access or mutate data belonging to
 * another tenant. The guard responds with HTTP 403 (Forbidden) and emits
 * a structured log line so that SIEM systems can correlate and alert.
 *
 * Rationale: plan moonlit-humming-reef §5.1 SmartERP — "Add a
 * tenant-scoping middleware that rejects requests where JWT tenant_id
 * claim conflicts with the URL or body tenant_id." Implemented as a
 * Guard rather than a Middleware so that the authenticated user object
 * populated by `AuthGuard('jwt')` is already attached to the request.
 *
 * OWASP references:
 *   - A01:2021 Broken Access Control
 *   - CWE-639  Authorization Bypass Through User-Controlled Key
 */
@Injectable()
export class TenantScopeGuard implements CanActivate {
  private readonly logger = new Logger(TenantScopeGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { tenantId?: string } }>();

    // If no authenticated user, let the upstream AuthGuard reject first.
    const tokenTenantId = request.user?.tenantId;
    if (!tokenTenantId) return true;

    const claimed = this.collectClaimedTenantIds(request);
    for (const claim of claimed) {
      if (claim && claim !== tokenTenantId) {
        this.logger.warn(
          `Tenant scope violation: token tenant=${tokenTenantId} ` +
            `attempted access to tenant=${claim} on ${request.method} ${request.originalUrl}`,
        );
        throw new ForbiddenException(
          'Cross-tenant access denied: token does not match requested tenant',
        );
      }
    }
    return true;
  }

  private collectClaimedTenantIds(request: Request): string[] {
    const claimed: string[] = [];

    const headerClaim = request.header('x-tenant-id');
    if (headerClaim) claimed.push(headerClaim);

    const query = request.query ?? {};
    if (typeof query.tenantId === 'string') claimed.push(query.tenantId);
    if (typeof query.tenant_id === 'string') claimed.push(query.tenant_id);

    const params = (request.params ?? {}) as Record<string, unknown>;
    if (typeof params.tenantId === 'string') claimed.push(params.tenantId);
    if (typeof params.tenant_id === 'string') claimed.push(params.tenant_id);

    const body = (request.body ?? {}) as Record<string, unknown>;
    if (typeof body.tenantId === 'string') claimed.push(body.tenantId);
    if (typeof body.tenant_id === 'string') claimed.push(body.tenant_id);

    return claimed;
  }
}
