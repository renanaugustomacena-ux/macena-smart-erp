/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * OpenTelemetry bootstrap.
 *
 * Closes gap B-11: instruments HTTP / Express / TypeORM / Redis with
 * W3C trace-context propagation and exports traces to the OTLP
 * collector named in `OTEL_EXPORTER_OTLP_ENDPOINT`. Metrics are left
 * to the Prometheus exposition in `metrics.controller.ts` because the
 * plan allows Prom-first metrics; OTel owns traces + structured logs.
 *
 * Must be imported from `main.ts` BEFORE `NestFactory.create(...)` so
 * the auto-instrumentations patch Express before the app is wired.
 */

// Guarded, lazy bootstrap so local dev / tests do not require the OTel
// dependency to be installed — we declare the deps in package.json but
// tolerate their absence at runtime.
export function bootstrapTelemetry(): void {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint || process.env.OTEL_DISABLED === 'true') {
    // eslint-disable-next-line no-console
    console.log(
      '[otel] OTEL_EXPORTER_OTLP_ENDPOINT not set — telemetry disabled.',
    );
    return;
  }
  try {
    // Require is dynamic so that an image built without otel deps still starts.
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const {
      getNodeAutoInstrumentations,
    } = require('@opentelemetry/auto-instrumentations-node');
    const {
      OTLPTraceExporter,
    } = require('@opentelemetry/exporter-trace-otlp-http');
    const { Resource } = require('@opentelemetry/resources');
    const {
      SemanticResourceAttributes,
    } = require('@opentelemetry/semantic-conventions');

    const sdk = new NodeSDK({
      traceExporter: new OTLPTraceExporter({
        url: `${endpoint.replace(/\/$/, '')}/v1/traces`,
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false },
        }),
      ],
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]:
          process.env.OTEL_SERVICE_NAME ?? 'smarterp-backend',
        [SemanticResourceAttributes.SERVICE_VERSION]:
          process.env.APP_VERSION ?? '1.0.0',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
          process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development',
      }),
    });
    sdk.start();
    // eslint-disable-next-line no-console
    console.log(`[otel] tracer started, exporting to ${endpoint}`);

    process.on('SIGTERM', () => {
      sdk
        .shutdown()
        .then(() => console.log('[otel] shutdown complete'))
        .catch((err: Error) => console.error('[otel] shutdown error', err));
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[otel] failed to bootstrap: ${
        err instanceof Error ? err.message : String(err)
      }. Install @opentelemetry/* deps to enable tracing.`,
    );
  }
}
