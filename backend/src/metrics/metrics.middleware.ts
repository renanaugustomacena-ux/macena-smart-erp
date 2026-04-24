import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    res.on('finish', () => {
      // Normalise the path — drop UUIDs so the cardinality stays bounded.
      const path = this.normalisePath(req.originalUrl.split('?')[0]);
      const labels = {
        method: req.method,
        path,
        status: String(res.statusCode),
      };
      this.metrics.increment('smarterp_http_requests_total', labels);
      if (res.statusCode >= 400) {
        this.metrics.increment('smarterp_http_errors_total', labels);
      }
    });
    next();
  }

  private normalisePath(path: string): string {
    return path
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
        ':id',
      )
      .replace(/\/\d+(?=\/|$)/g, '/:id');
  }
}
