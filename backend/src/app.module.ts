import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import * as redisStore from 'cache-manager-redis-store';

import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { InventoryModule } from './inventory/inventory.module';
import { ProductionModule } from './production/production.module';
import { SalesModule } from './sales/sales.module';
import { AccountingModule } from './accounting/accounting.module';
import { ProcurementModule } from './procurement/procurement.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { ConservazioneModule } from './conservazione/conservazione.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { PecModule } from './pec/pec.module';
import { IntrastatModule } from './intrastat/intrastat.module';
import { MembershipsModule } from './memberships/memberships.module';
import { CommercialistaModule } from './commercialista/commercialista.module';
import { HrModule } from './hr/hr.module';
import { BiModule } from './bi/bi.module';
import { MetricsModule } from './metrics/metrics.module';
import { QueuesModule } from './queues/queues.module';
import { AuditModule } from './audit/audit.module';
import { databaseConfig } from './config/database.config';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { SecurityHeadersMiddleware } from './common/security-headers.middleware';

/**
 * Composition root. Wires cross-cutting providers (config, ORM, cache,
 * rate limiting, Prometheus metrics, BullMQ queues, audit log) and every
 * domain-bounded-context module per the DDD partitioning in MODUS_OPERANDI
 * section 4.2.
 *
 * Security-relevant globals:
 *   - APP_GUARD ThrottlerGuard — rate limits every route (120/min default,
 *     5/min on auth endpoints via @Throttle override).
 *   - ValidationPipe (registered in main.ts) — strict DTO validation.
 *   - TenantScopeGuard (applied per feature controller) — cross-tenant
 *     request rejection.
 *   - ProblemDetailsFilter (registered in main.ts) — RFC 7807 error
 *     responses.
 *   - AuditInterceptor (APP_INTERCEPTOR via AuditModule) — audit log
 *     writer for every non-GET request.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: databaseConfig,
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get<string>('REDIS_HOST', 'localhost'),
        port: configService.get<number>('REDIS_PORT', 6379),
        password: configService.get<string>('REDIS_PASSWORD', '') || undefined,
        ttl: configService.get<number>('CACHE_TTL', 300),
        max: configService.get<number>('CACHE_MAX_ITEMS', 1000),
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: configService.get<number>('THROTTLE_TTL', 60_000),
            limit: configService.get<number>('THROTTLE_LIMIT', 120),
          },
          {
            name: 'auth',
            ttl: 60_000,
            limit: 5, // v2.0 §20.9: 5/min/IP on auth endpoints
          },
        ],
      }),
    }),

    MetricsModule,
    AuditModule,
    QueuesModule,
    HealthModule,
    AuthModule,
    TenantsModule,
    InventoryModule,
    ProductionModule,
    SalesModule,
    AccountingModule,
    ProcurementModule,
    WarehouseModule,
    ConservazioneModule,
    WebhooksModule,
    PecModule,
    IntrastatModule,
    MembershipsModule,
    CommercialistaModule,
    HrModule,
    BiModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(CorrelationIdMiddleware, SecurityHeadersMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
