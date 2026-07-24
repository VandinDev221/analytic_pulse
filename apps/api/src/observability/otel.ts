/**
 * Bootstrap OpenTelemetry (traces + metrics via OTLP HTTP).
 * Só inicia se OTEL_EXPORTER_OTLP_ENDPOINT estiver definido
 * (e OTEL_SDK_DISABLED não for true).
 *
 * Importar este módulo o mais cedo possível (antes das rotas Express).
 */
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | null = null;
let started = false;

function readEnv(name: string): string | undefined {
  const v = process.env[name];
  if (v === undefined || v === '') return undefined;
  return v;
}

export function isOtelEnabled(): boolean {
  if ((readEnv('OTEL_SDK_DISABLED') || '').toLowerCase() === 'true') return false;
  return Boolean(readEnv('OTEL_EXPORTER_OTLP_ENDPOINT'));
}

export function getOtelStatus() {
  const endpoint = readEnv('OTEL_EXPORTER_OTLP_ENDPOINT');
  return {
    enabled: isOtelEnabled() && started,
    configured: Boolean(endpoint),
    service_name: readEnv('OTEL_SERVICE_NAME') || 'analytic-pulse-api',
    endpoint: endpoint ? sanitizeEndpoint(endpoint) : null,
  };
}

function sanitizeEndpoint(url: string): string {
  try {
    const u = new URL(url);
    u.username = '';
    u.password = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return '(invalid)';
  }
}

function otlpUrl(base: string, signalPath: string): string {
  const trimmed = base.replace(/\/$/, '');
  if (trimmed.endsWith('/v1/traces') || trimmed.endsWith('/v1/metrics')) {
    return trimmed;
  }
  return `${trimmed}${signalPath}`;
}

export function startOtel(): void {
  if (started || sdk) return;
  if (!isOtelEnabled()) return;

  const endpoint = readEnv('OTEL_EXPORTER_OTLP_ENDPOINT')!;
  const serviceName = readEnv('OTEL_SERVICE_NAME') || 'analytic-pulse-api';
  const serviceVersion = readEnv('OTEL_SERVICE_VERSION') || '1.0.0';

  if ((readEnv('OTEL_DIAGNOSTICS') || '').toLowerCase() === 'true') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
  }

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
  });

  const traceExporter = new OTLPTraceExporter({
    url: otlpUrl(endpoint, '/v1/traces'),
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: otlpUrl(endpoint, '/v1/metrics'),
    }),
    exportIntervalMillis: Number(readEnv('OTEL_METRIC_EXPORT_INTERVAL') || '60000'),
  });

  sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: true },
      }),
    ],
  });

  sdk.start();
  started = true;

  const shutdown = async () => {
    try {
      await sdk?.shutdown();
    } catch {
      // ignore
    }
  };
  process.once('SIGTERM', () => {
    void shutdown();
  });
  process.once('SIGINT', () => {
    void shutdown();
  });
}
