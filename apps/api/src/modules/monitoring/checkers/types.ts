import type { CheckResult, CheckType, Monitor, TimingBreakdown } from '@analytic-pulse/shared';

export type CheckableMonitor = Pick<
  Monitor,
  | 'id'
  | 'name'
  | 'url'
  | 'method'
  | 'check_type'
  | 'host'
  | 'port'
  | 'dns_record_type'
  | 'keyword'
  | 'expected_status_codes'
  | 'expected_header_name'
  | 'expected_header_value'
  | 'json_path'
  | 'json_expected'
  | 'request_headers'
  | 'request_body'
  | 'ssl_warn_days'
>;

export interface Checker {
  readonly type: CheckType | readonly CheckType[];
  check(monitor: CheckableMonitor): Promise<CheckResult>;
}

export function emptyTimings(totalMs: number): TimingBreakdown {
  return {
    dns_ms: null,
    tcp_ms: null,
    tls_ms: null,
    ttfb_ms: null,
    download_ms: null,
    total_ms: totalMs,
  };
}

export function failResult(
  checkType: CheckType,
  totalMs: number,
  error: string,
  timings?: Partial<TimingBreakdown>
): CheckResult {
  return {
    status_code: null,
    response_time_ms: Math.round(totalMs),
    is_up: false,
    error_message: error.substring(0, 255),
    check_type: checkType,
    timings: { ...emptyTimings(Math.round(totalMs)), ...timings, total_ms: Math.round(totalMs) },
    response_size_bytes: null,
    content_length: null,
    response_headers: null,
    redirect_chain: null,
  };
}

export function resolveHost(monitor: CheckableMonitor): string {
  if (monitor.host?.trim()) return monitor.host.trim();
  try {
    const u = new URL(monitor.url);
    return u.hostname;
  } catch {
    // tcp://host:port or bare host:port
    const raw = monitor.url.replace(/^(tcp|ssl|ping|dns):\/\//i, '');
    return raw.split(':')[0] || raw;
  }
}

export function resolvePort(
  monitor: CheckableMonitor,
  fallback: number
): number {
  if (monitor.port && monitor.port > 0) return monitor.port;
  try {
    const u = new URL(monitor.url);
    if (u.port) return Number(u.port);
    if (u.protocol === 'https:') return 443;
    if (u.protocol === 'http:') return 80;
  } catch {
    const raw = monitor.url.replace(/^(tcp|ssl|ping|dns):\/\//i, '');
    const parts = raw.split(':');
    if (parts.length > 1 && Number(parts[1]) > 0) return Number(parts[1]);
  }
  return fallback;
}
