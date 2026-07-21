/**
 * Contadores em memória — baseline de métricas internas.
 * Preparado para trocar por Prometheus/OTel sem mudar callers.
 */

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

export function inc(name: keyof typeof counters | string, by = 1): void {
  counters[name] = (counters[name] ?? 0) + by;
}

export function setLastPingCycleDuration(ms: number): void {
  lastPingCycleMs = ms;
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
}
