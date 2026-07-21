import net from 'net';
import type { CheckResult } from '@analytic-pulse/shared';
import {
  failResult,
  resolveHost,
  resolvePort,
  type CheckableMonitor,
  type Checker,
} from './types';

function connectTcp(
  host: string,
  port: number,
  timeoutMs: number
): Promise<{ ok: boolean; tcpMs: number; error?: string }> {
  const start = Date.now();
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let settled = false;

    const finish = (ok: boolean, error?: string) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ ok, tcpMs: Date.now() - start, error });
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false, 'TIMEOUT'));
    socket.once('error', (err) => finish(false, err.message));
  });
}

export class TcpChecker implements Checker {
  readonly type = ['tcp', 'port'] as const;

  async check(monitor: CheckableMonitor): Promise<CheckResult> {
    const host = resolveHost(monitor);
    const port = resolvePort(monitor, 80);
    const checkType = monitor.check_type === 'port' ? 'port' : 'tcp';

    if (!host || !port) {
      return failResult(checkType, 0, 'Host and port are required');
    }

    const { ok, tcpMs, error } = await connectTcp(host, port, 10_000);

    if (!ok) {
      return failResult(checkType, tcpMs, error || 'CONNECTION_FAILED', {
        tcp_ms: tcpMs,
      });
    }

    return {
      status_code: null,
      response_time_ms: tcpMs,
      is_up: true,
      error_message: null,
      check_type: checkType,
      timings: {
        dns_ms: null,
        tcp_ms: tcpMs,
        tls_ms: null,
        ttfb_ms: null,
        download_ms: null,
        total_ms: tcpMs,
      },
      response_size_bytes: null,
      content_length: null,
      response_headers: null,
      redirect_chain: null,
      meta: { host, port },
    };
  }
}

export { connectTcp };
