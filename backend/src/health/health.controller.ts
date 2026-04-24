import { Controller, Get, Inject } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

interface DependencyStatus {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

/**
 * Canonical health response shape expected by plan gate G2.
 *
 * Includes both the G2-mandated keys (`status`, `service`, `version`,
 * `uptime_seconds`, `time`, `dependencies`) AND the legacy aliases
 * (`timestamp`, `uptime`) kept for backward compatibility with the
 * pre-Mission II e2e tests and older front-end consumers. Removing the
 * legacy aliases in a future major version will require a deprecation
 * notice in CHANGELOG.md.
 */
interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  service: string;
  version: string;
  build_sha: string;
  uptime_seconds: number;
  uptime: number;
  time: string;
  timestamp: string;
  dependencies: {
    postgres: DependencyStatus;
    redis: DependencyStatus;
  };
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Full health probe including PostgreSQL and Redis dependency status',
  })
  @ApiResponse({ status: 200, description: 'Service status returned' })
  async getHealth(): Promise<HealthResponse> {
    const [postgres, redis] = await Promise.all([
      this.probePostgres(),
      this.probeRedis(),
    ]);
    const depsUp = postgres.status === 'up' && redis.status === 'up';
    const status: HealthResponse['status'] = depsUp
      ? 'ok'
      : postgres.status === 'down' && redis.status === 'down'
        ? 'down'
        : 'degraded';
    const now = new Date();
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    return {
      status,
      service: 'smarterp-backend',
      version: process.env.APP_VERSION ?? '1.0.0',
      build_sha: process.env.BUILD_SHA ?? 'dev',
      uptime_seconds: uptimeSeconds,
      uptime: uptimeSeconds,
      time: now.toISOString(),
      timestamp: now.toISOString(),
      dependencies: { postgres, redis },
    };
  }

  @Get('live')
  @ApiOperation({ summary: 'Kubernetes liveness probe' })
  @ApiResponse({ status: 200, description: 'Process alive' })
  getLiveness(): { status: 'alive' } {
    return { status: 'alive' };
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Kubernetes readiness probe (requires all deps UP)',
  })
  @ApiResponse({ status: 200, description: 'Ready to receive traffic' })
  async getReadiness(): Promise<{
    status: 'ready' | 'not_ready';
    dependencies: { postgres: DependencyStatus; redis: DependencyStatus };
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

  private async probePostgres(): Promise<DependencyStatus> {
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

  private async probeRedis(): Promise<DependencyStatus> {
    const t0 = Date.now();
    try {
      const probeKey = '__health_probe__';
      await this.cacheManager.set(probeKey, '1', 10);
      await this.cacheManager.get(probeKey);
      return { status: 'up', latencyMs: Date.now() - t0 };
    } catch (err) {
      return {
        status: 'down',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
