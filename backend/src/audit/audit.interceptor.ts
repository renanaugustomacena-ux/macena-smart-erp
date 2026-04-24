import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request, Response } from 'express';

import { AuditLog } from './audit-log.entity';

const AUDITED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Writes one audit_logs row for every state-changing HTTP request.
 *
 * Best-effort: a DB error while persisting the audit row is logged at
 * `warn` level but never propagated, so auditing can never 500 the
 * business request. Structured application logs still go to stdout as
 * a secondary channel.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context
      .switchToHttp()
      .getRequest<
        Request & {
          user?: { id?: string; email?: string; tenantId?: string };
          correlationId?: string;
          route?: { path?: string };
        }
      >();

    if (!AUDITED_METHODS.has(req.method)) {
      return next.handle();
    }
    // Do not audit health/ready/metrics churn.
    const path = req.originalUrl ?? req.url ?? '';
    if (path.startsWith('/api/health') || path === '/metrics') {
      return next.handle();
    }

    const start = Date.now();
    const ctx = context.switchToHttp();
    return next.handle().pipe(
      tap(() => {
        const res = ctx.getResponse<Response>();
        this.writeAudit(req, res.statusCode, 'success', Date.now() - start);
      }),
      catchError((err: unknown) => {
        const status = this.extractStatus(err);
        this.writeAudit(
          req,
          status,
          status >= 500 ? 'failure' : 'denied',
          Date.now() - start,
        );
        return throwError(() => err);
      }),
    );
  }

  private extractStatus(err: unknown): number {
    if (
      err &&
      typeof err === 'object' &&
      'getStatus' in err &&
      typeof (err as { getStatus: () => number }).getStatus === 'function'
    ) {
      return (err as { getStatus: () => number }).getStatus();
    }
    return 500;
  }

  private writeAudit(
    req: Request & {
      user?: { id?: string; email?: string; tenantId?: string };
      correlationId?: string;
    },
    statusCode: number,
    outcome: 'success' | 'failure' | 'denied',
    _durationMs: number,
  ): void {
    try {
      const action = this.resolveAction(req);
      const record: Partial<AuditLog> = {
        tenantId: req.user?.tenantId ?? null,
        userId: req.user?.id ?? null,
        actorEmail: req.user?.email ?? null,
        action,
        resourceType: this.resolveResourceType(req),
        resourceId: this.resolveResourceId(req),
        method: req.method,
        path: (req.originalUrl ?? req.url ?? '').slice(0, 500),
        statusCode,
        ipAddress:
          (typeof req.ip === 'string' && req.ip) ||
          (req.headers['x-forwarded-for'] as string) ||
          null,
        userAgent:
          typeof req.headers['user-agent'] === 'string'
            ? req.headers['user-agent'].slice(0, 500)
            : null,
        correlationId: req.correlationId ?? null,
        diff: null,
        outcome,
      };
      // Fire and forget. Even if the write fails (e.g., DB not migrated),
      // the request already completed; keep the latency hit off the hot path.
      this.auditRepo
        .insert(record)
        .catch((err: Error) =>
          this.logger.warn(
            `audit_logs insert failed (${err.message}); path=${record.path}`,
          ),
        );
    } catch (err) {
      this.logger.warn(
        `audit interceptor pre-write failure: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private resolveAction(req: Request): string {
    // Simple verb inference; service-level decorators could override this.
    const parts = (req.originalUrl ?? req.url ?? '').split('?')[0].split('/').filter(Boolean);
    // Strip /api/v1 prefix
    const stripped = parts[0] === 'api' ? parts.slice(parts[1] === 'v1' ? 2 : 1) : parts;
    const resource = stripped[0] ?? 'unknown';
    switch (req.method) {
      case 'POST':
        return `${resource}.create`;
      case 'PUT':
      case 'PATCH':
        return `${resource}.update`;
      case 'DELETE':
        return `${resource}.delete`;
      default:
        return `${resource}.${req.method.toLowerCase()}`;
    }
  }

  private resolveResourceType(req: Request): string | null {
    const parts = (req.originalUrl ?? req.url ?? '').split('?')[0].split('/').filter(Boolean);
    return parts[parts[0] === 'api' ? (parts[1] === 'v1' ? 2 : 1) : 0] ?? null;
  }

  private resolveResourceId(req: Request): string | null {
    const params = req.params as Record<string, unknown>;
    const candidate = params?.id ?? params?.invoiceId ?? params?.productId;
    return typeof candidate === 'string' ? candidate : null;
  }
}
