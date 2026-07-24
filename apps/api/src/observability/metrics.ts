/**
 * Contadores em memória — baseline de métricas internas.
 * Quando OTel está ativo, espelha contadores no Meter API (OTLP).
 */

import { metrics, type Counter, type Histogram } from '@opentelemetry/api';
import { isOtelEnabled } from './otel';

type CounterMap = Record<string, number>;

const counters: CounterMap = {
  http_requests_total: 0,
  ping_checks_total: 0,
  ping_checks_up_total: 0,
  ping_checks_down_total: 0,
  ping_cycles_total: 0,
  ping_cycle_failures_total: 0,
  notifications_sent_total: 0,
};

let lastPingCycleMs = 0;
let startedAt = Date.now();

const otelCounterCache = new Map<string, Counter>();
let pingCycleHistogram: Histogram | null = null;

function otelInc(name: string, by: number): void {
  if (!isOtelEnabled()) return;
  try {
    let counter = otelCounterCache.get(name);
    if (!counter) {
      const meter = metrics.getMeter('analytic-pulse');
      counter = meter.createCounter(`pulse.${name}`, {
        description: `Analytic Pulse counter: ${name}`,
      });
      otelCounterCache.set(name, counter);
    }
    counter.add(by);
  } catch {
    // SDK ainda não pronto / métricas desabilitadas
  }
}

export function inc(name: keyof typeof counters | string, by = 1): void {
  counters[name] = (counters[name] ?? 0) + by;
  otelInc(String(name), by);
}

export function setLastPingCycleDuration(ms: number): void {
  lastPingCycleMs = ms;
  if (!isOtelEnabled()) return;
  try {
    if (!pingCycleHistogram) {
      pingCycleHistogram = metrics
        .getMeter('analytic-pulse')
        .createHistogram('pulse.ping_cycle_duration_ms', {
          description: 'Duração do ciclo de ping (ms)',
          unit: 'ms',
        });
    }
    pingCycleHistogram.record(ms);
  } catch {
    // ignore
  }
}

export function recordPingResult(isUp: boolean): void {
  inc('ping_checks_total');
  if (isUp) inc('ping_checks_up_total');
  else inc('ping_checks_down_total');
}

export function getMetricsSnapshot() {
  return {
    uptime_ms: Date.now() - startedAt,
    last_ping_cycle_ms: lastPingCycleMs,
    counters: { ...counters },
  };
}

export function resetMetricsForTests(): void {
  for (const key of Object.keys(counters)) {
    counters[key] = 0;
  }
  lastPingCycleMs = 0;
  startedAt = Date.now();
  otelCounterCache.clear();
  pingCycleHistogram = null;
}
