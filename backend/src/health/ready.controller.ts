import { Controller, Get, Inject } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

/**
 * Distinct `/api/ready` route.
 *
 * Closes gap G3 requirement that readiness is routable at the canonical
 * `/api/ready` path (the health module also exposes /api/health/ready
 * for Kubernetes readinessProbe backward-compatibility). Returning
 * `{ status: 'ready' | 'not_ready' }` matches the SHARED-SCHEMAS.md
 * canonical readiness shape.
 */
interface ReadinessDependency {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

@ApiTags('Health')
@Controller('ready')
export class ReadyController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Canonical readiness probe. 200 when all dependencies are UP, 503 otherwise.',
  })
  @ApiResponse({ status: 200, description: 'Ready' })
  @ApiResponse({ status: 503, description: 'Not ready' })
  async getReady(): Promise<{
    status: 'ready' | 'not_ready';
    dependencies: { postgres: ReadinessDependency; redis: ReadinessDependency };
  }> {
    const [postgres, redis] = await Promise.all([
      this.probePostgres(),
      this.probeRedis(),
    ]);
    const ready = postgres.status === 'up' && redis.status === 'up';
    return {
      status: ready ? 'ready' : 'not_ready',
      dependencies: { postgres, redis },
    };
  }

  private async probePostgres(): Promise<ReadinessDependency> {
    const t0 = Date.now();
    try {
      if (!this.dataSource?.isInitialized) {
        return { status: 'down', error: 'datasource not initialised' };
      }
      await this.dataSource.query('SELECT 1');
      return { status: 'up', latencyMs: Date.now() - t0 };
    } catch (err) {
      return {
        status: 'down',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async probeRedis(): Promise<ReadinessDependency> {
    const t0 = Date.now();
    try {
      await this.cacheManager.set('__ready_probe__', '1', 10);
      await this.cacheManager.get('__ready_probe__');
      return { status: 'up', latencyMs: Date.now() - t0 };
    } catch (err) {
      return {
        status: 'down',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
