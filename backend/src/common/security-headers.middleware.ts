import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * Supplemental security headers middleware.
 *
 * Helmet already covers most of the OWASP ASVS L2 baseline in `main.ts`;
 * this middleware adds the headers Helmet does not emit by default and
 * the ones the GAPS report flagged as missing (G-03, G-04 baseline):
 *
 *   - Permissions-Policy: deny dangerous features by default.
 *   - X-Content-Type-Options: `nosniff` (also set by Helmet — kept for
 *     defence in depth).
 *   - Referrer-Policy: `strict-origin-when-cross-origin`.
 *   - Cross-Origin-Opener-Policy / Cross-Origin-Resource-Policy.
 *
 * Wired in `app.module.ts` for every route.
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(_req: Request, res: Response, next: NextFunction): void {
    res.setHeader(
      'Permissions-Policy',
      [
        'accelerometer=()',
        'camera=()',
        'geolocation=()',
        'gyroscope=()',
        'magnetometer=()',
        'microphone=()',
        'payment=()',
        'usb=()',
        'interest-cohort=()',
      ].join(', '),
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    next();
  }
}
