import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';

/**
 * Prometheus scrape endpoint.
 *
 * Exposed intentionally outside of the `/api` prefix to match the
 * community convention (`/metrics`); this is configured in `main.ts`
 * via `app.setGlobalPrefix('api', { exclude: ['metrics'] })`.
 */
@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  exposition(): string {
    return this.metrics.render();
  }
}
