import tls from 'tls';
import type { CheckResult } from '@analytic-pulse/shared';
import {
  failResult,
  resolveHost,
  resolvePort,
  type CheckableMonitor,
  type Checker,
} from './types';

function dnToString(dn: unknown): string | null {
  if (!dn || typeof dn !== 'object') return null;
  const entries = Object.entries(dn as Record<string, unknown>)
    .filter(([, v]) => v != null && String(v).length > 0)
    .map(([k, v]) => `${k}=${v}`);
  return entries.length ? entries.join(', ') : null;
}

function cipherToString(cipher: tls.CipherNameAndProtocol | undefined): string | null {
  if (!cipher) return null;
  return [cipher.name, cipher.version].filter(Boolean).join(' · ') || null;
}

export class SslChecker implements Checker {
  readonly type = 'ssl';

  async check(monitor: CheckableMonitor): Promise<CheckResult> {
    const host = resolveHost(monitor);
    const port = resolvePort(monitor, 443);
    const start = Date.now();

    if (!host) {
      return failResult('ssl', 0, 'Host is required for SSL check');
    }

    return new Promise((resolve) => {
      const socket = tls.connect(
        {
          host,
          port,
          servername: host,
          rejectUnauthorized: false,
          timeout: 10_000,
        },
        () => {
          const totalMs = Date.now() - start;
          const cert = socket.getPeerCertificate();
          const protocol = socket.getProtocol();
          const cipher = socket.getCipher();
          socket.end();

          if (!cert || Object.keys(cert).length === 0) {
            resolve(
              failResult('ssl', totalMs, 'NO_CERTIFICATE', { tls_ms: totalMs })
            );
            return;
          }

          const validFrom = cert.valid_from ? new Date(cert.valid_from) : null;
          const validTo = cert.valid_to ? new Date(cert.valid_to) : null;
          const daysRemaining = validTo
            ? Math.ceil((validTo.getTime() - Date.now()) / 86_400_000)
            : null;
          const expired = daysRemaining !== null && daysRemaining < 0;
          const warnDays =
            typeof (monitor as { ssl_warn_days?: number }).ssl_warn_days === 'number'
              ? (monitor as { ssl_warn_days: number }).ssl_warn_days
              : 30;
          const expiringSoon =
            !expired &&
            daysRemaining !== null &&
            daysRemaining <= warnDays;

          resolve({
            status_code: null,
            response_time_ms: totalMs,
            is_up: !expired,
            error_message: expired
              ? 'CERTIFICATE_EXPIRED'
              : expiringSoon
                ? 'CERTIFICATE_EXPIRING_SOON'
                : null,
            check_type: 'ssl',
            timings: {
              dns_ms: null,
              tcp_ms: null,
              tls_ms: totalMs,
              ttfb_ms: null,
              download_ms: null,
              total_ms: totalMs,
            },
            response_size_bytes: null,
            content_length: null,
            response_headers: null,
            redirect_chain: null,
            meta: {
              host,
              port,
              issuer: dnToString(cert.issuer),
              subject: dnToString(cert.subject),
              valid_from: validFrom ? validFrom.toISOString() : null,
              valid_to: validTo ? validTo.toISOString() : null,
              days_remaining: daysRemaining,
              fingerprint: cert.fingerprint || null,
              protocol: protocol || null,
              cipher: cipherToString(cipher),
              warn_days: warnDays,
            },
          });
        }
      );

      socket.on('error', (err) => {
        const totalMs = Date.now() - start;
        resolve(
          failResult('ssl', totalMs, err.message || 'TLS_HANDSHAKE_FAILED', {
            tls_ms: totalMs,
          })
        );
      });

      socket.on('timeout', () => {
        socket.destroy();
        const totalMs = Date.now() - start;
        resolve(failResult('ssl', totalMs, 'TIMEOUT', { tls_ms: totalMs }));
      });
    });
  }
}
