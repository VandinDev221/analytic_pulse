import { execFile } from 'child_process';
import { promisify } from 'util';
import type { CheckResult } from '@analytic-pulse/shared';
import { connectTcp } from './TcpChecker';
import {
  failResult,
  resolveHost,
  type CheckableMonitor,
  type Checker,
} from './types';

const execFileAsync = promisify(execFile);

function parsePingTimeMs(stdout: string): number | null {
  const match =
    stdout.match(/time[=<]([\d.]+)\s*ms/i) ||
    stdout.match(/tempo[=<]([\d.]+)\s*ms/i);
  return match ? Math.round(Number(match[1])) : null;
}

async function icmpPing(host: string): Promise<{ ok: boolean; ms: number; error?: string }> {
  const isWin = process.platform === 'win32';
  const args = isWin ? ['-n', '1', '-w', '5000', host] : ['-c', '1', '-W', '5', host];
  const start = Date.now();

  try {
    const { stdout } = await execFileAsync('ping', args, {
      timeout: 10_000,
      windowsHide: true,
    });
    const ms = parsePingTimeMs(stdout) ?? Date.now() - start;
    const failed =
      /100%\s*(loss|perda)/i.test(stdout) ||
      /could not find host|falha geral|unreachable/i.test(stdout);
    return failed
      ? { ok: false, ms, error: 'PING_FAILED' }
      : { ok: true, ms };
  } catch (error) {
    return {
      ok: false,
      ms: Date.now() - start,
      error: error instanceof Error ? error.message : 'PING_UNAVAILABLE',
    };
  }
}

/**
 * ICMP quando disponível; fallback TCP:80/:443 em ambientes sem raw socket (ex.: PaaS).
 */
export class PingChecker implements Checker {
  readonly type = 'ping';

  async check(monitor: CheckableMonitor): Promise<CheckResult> {
    const host = resolveHost(monitor);
    if (!host) {
      return failResult('ping', 0, 'Host is required for PING check');
    }

    const icmp = await icmpPing(host);
    if (icmp.ok) {
      return {
        status_code: null,
        response_time_ms: icmp.ms,
        is_up: true,
        error_message: null,
        check_type: 'ping',
        timings: {
          dns_ms: null,
          tcp_ms: null,
          tls_ms: null,
          ttfb_ms: null,
          download_ms: null,
          total_ms: icmp.ms,
        },
        response_size_bytes: null,
        content_length: null,
        response_headers: null,
        redirect_chain: null,
        meta: { host, method: 'icmp' },
      };
    }

    // Fallback TCP connectivity
    for (const port of [80, 443]) {
      const tcp = await connectTcp(host, port, 5_000);
      if (tcp.ok) {
        return {
          status_code: null,
          response_time_ms: tcp.tcpMs,
          is_up: true,
          error_message: null,
          check_type: 'ping',
          timings: {
            dns_ms: null,
            tcp_ms: tcp.tcpMs,
            tls_ms: null,
            ttfb_ms: null,
            download_ms: null,
            total_ms: tcp.tcpMs,
          },
          response_size_bytes: null,
          content_length: null,
          response_headers: null,
          redirect_chain: null,
          meta: {
            host,
            method: 'tcp_fallback',
            port,
            icmp_error: icmp.error,
          },
        };
      }
    }

    return failResult(
      'ping',
      icmp.ms,
      icmp.error || 'HOST_UNREACHABLE'
    );
  }
}
