import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import * as crypto from 'crypto';

/**
 * Lightweight double-submit CSRF middleware.
 *
 * Closes gap G-04. NestJS / Passport-JWT uses Bearer tokens in the
 * `Authorization` header, so the canonical CSRF threat (authenticated
 * cookie riding along with a cross-site form POST) does not apply to
 * the JSON API. This middleware enforces CSRF protection on the
 * optional cookie-based session flow used by the embedded admin UI:
 *
 *   - Every state-changing request (POST/PUT/PATCH/DELETE) MUST
 *     supply `X-CSRF-Token` header equal to the `csrf_token` cookie.
 *   - The cookie is set on GET /api/csrf-token (stateless — value is
 *     a 32-byte random hex issued per session).
 *
 * In production with a pure JWT client the middleware is inert because
 * the client sets `X-Session-Auth: false` and the middleware short-
 * circuits; see Security section of RUNBOOK.md for the detailed
 * threat-model write-up.
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const method = req.method.toUpperCase();
    const safe = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
    const path = req.originalUrl ?? req.url ?? '';

    // Endpoints exempted from CSRF: health/ready/metrics, plus the login
    // endpoint (pre-session) and the token-mint endpoint itself.
    if (
      path.startsWith('/api/health') ||
      path === '/metrics' ||
      path.startsWith('/api/auth/login') ||
      path.startsWith('/api/auth/register') ||
      path.startsWith('/api/auth/refresh') ||
      path.startsWith('/api/csrf-token')
    ) {
      return next();
    }

    // If the request carries an Authorization: Bearer header, we assume a
    // pure-API client and skip CSRF. Cookie-based sessions hit the branch
    // below.
    const auth = req.headers['authorization'];
    if (auth && auth.toLowerCase().startsWith('bearer ')) return next();

    if (safe) return next();

    const cookieHeader = req.headers['cookie'] ?? '';
    const cookieToken = /csrf_token=([A-Za-z0-9]+)/.exec(cookieHeader)?.[1];
    const headerToken = req.headers['x-csrf-token'] as string | undefined;
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException({
        message: 'CSRF token missing or mismatched',
      });
    }
    next();
  }

  static mintToken(res: Response): string {
    const token = crypto.randomBytes(32).toString('hex');
    res.setHeader(
      'Set-Cookie',
      `csrf_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`,
    );
    return token;
  }
}
