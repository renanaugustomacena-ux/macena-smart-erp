import { bootstrapTelemetry } from './telemetry';
// OTel must start BEFORE Nest imports so auto-instrumentations patch Express.
bootstrapTelemetry();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/problem-details.filter';

/**
 * Bootstrap the SmartERP NestJS application.
 *
 * Hardening applied:
 *  - Helmet with OWASP ASVS L2 baseline (CSP, HSTS prod, X-Content-Type-
 *    Options, Referrer-Policy, Permissions-Policy, X-Frame-Options).
 *  - Supplemental SecurityHeadersMiddleware wired via AppModule for the
 *    headers Helmet does not set (Permissions-Policy feature list,
 *    Cross-Origin-Resource-Policy, X-Permitted-Cross-Domain-Policies).
 *  - RFC 7807 ProblemDetailsFilter registered globally (gap B-06).
 *  - Correlation-ID middleware emits / propagates X-Request-ID.
 *  - Audit interceptor persists every non-GET request to audit_logs.
 *  - Strict ValidationPipe.
 *  - Swagger UI non-production only; OpenAPI JSON dumped to
 *    `/tmp/openapi.json` for CI artefact pickup.
 *  - Graceful shutdown so BullMQ workers + DB connections drain.
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    bufferLogs: true,
  });

  // Trust proxy for correct `req.ip` behind Kubernetes Ingress / ALB.
  const httpAdapter = app.getHttpAdapter().getInstance();
  if (httpAdapter && typeof httpAdapter.set === 'function') {
    httpAdapter.set('trust proxy', 1);
  }

  const isProd = process.env.NODE_ENV === 'production';
  app.use(
    helmet({
      contentSecurityPolicy: isProd
        ? {
            useDefaults: true,
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:'],
              connectSrc: ["'self'"],
              frameAncestors: ["'none'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: isProd
        ? { maxAge: 63072000, includeSubDomains: true, preload: true }
        : false,
    }),
  );

  app.setGlobalPrefix('api', { exclude: ['metrics'] });

  const allowedOrigins =
    process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()) ?? [
      'http://localhost:3000',
    ];
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Tenant-ID',
      'X-Request-ID',
      'X-CSRF-Token',
    ],
    exposedHeaders: ['X-Request-ID'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // RFC 7807 — application/problem+json for every HTTP error.
  app.useGlobalFilters(new ProblemDetailsFilter());

  // OpenAPI / Swagger — non-production only, plus disk dump for CI.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('SmartERP API')
    .setDescription(
      'Cloud ERP for Italian manufacturing SMEs — Mozzecane (VR), Verona, Italy. ' +
        'Multi-tenant, FatturaPA v1.2.2 compliant, Piano dei Conti IV Direttiva CEE.',
    )
    .setVersion(process.env.APP_VERSION ?? '1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'JWT Bearer token issued by /api/auth/login',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Health', 'Health, liveness, readiness probes')
    .addTag('Auth', 'Authentication and token management')
    .addTag('Tenants', 'Tenant (organisation) lifecycle')
    .addTag('Inventory', 'Products, warehouses, stock ledger')
    .addTag('Production', 'Production orders and work orders')
    .addTag('Sales', 'Customers and sales orders')
    .addTag(
      'Accounting',
      'Chart of accounts, journal entries, FatturaPA electronic invoices, IVA liquidation',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  if (!isProd) {
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        showRequestDuration: true,
      },
    });
  }

  // Dump to disk so CI can upload openapi.json as artefact (gap A-07 / B-05).
  try {
    const dumpPath =
      process.env.OPENAPI_DUMP_PATH ?? path.join('/tmp', 'openapi.json');
    fs.writeFileSync(dumpPath, JSON.stringify(document, null, 2), 'utf8');
    logger.log(`OpenAPI spec written to ${dumpPath}`);
  } catch (err) {
    logger.warn(
      `Could not write OpenAPI dump: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  app.enableShutdownHooks();
  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down gracefully...`);
    try {
      await app.close();
      logger.log('Application closed cleanly');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown', err as Error);
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  const port = Number(process.env.APP_PORT ?? process.env.PORT ?? 3001);
  await app.listen(port);
  logger.log(`SmartERP backend listening on port ${port}`);
  logger.log(`Health endpoint  -> http://localhost:${port}/api/health`);
  logger.log(`Readiness probe  -> http://localhost:${port}/api/ready`);
  logger.log(`Metrics endpoint -> http://localhost:${port}/metrics`);
  if (!isProd) {
    logger.log(`Swagger UI       -> http://localhost:${port}/api/docs`);
  }
  logger.log(`Environment      -> ${process.env.APP_ENV ?? 'development'}`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
