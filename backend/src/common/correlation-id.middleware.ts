import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

/**
 * Correlation-ID middleware.
 *
 * Accepts an incoming `X-Request-ID` from upstream proxies (API gateway,
 * CloudFront, nginx) and propagates it onto the request object for
 * structured logs + the RFC 7807 problem filter. If none supplied,
 * mints a fresh UUIDv4.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(
    req: Request & { correlationId?: string },
    res: Response,
    next: NextFunction,
  ): void {
    const incoming = req.headers['x-request-id'];
    const correlationId =
      typeof incoming === 'string' && incoming.length > 0 && incoming.length < 128
        ? incoming
        : randomUUID();
    req.correlationId = correlationId;
    res.setHeader('X-Request-ID', correlationId);
    next();
  }
}
