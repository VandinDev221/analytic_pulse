import tls from 'tls';
import type { CheckResult } from '@analytic-pulse/shared';
import {
  failResult,
  resolveHost,
  resolvePort,
  type CheckableMonitor,
  type Checker,
} from './types';

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
          socket.end();

          if (!cert || Object.keys(cert).length === 0) {
            resolve(
              failResult('ssl', totalMs, 'NO_CERTIFICATE', { tls_ms: totalMs })
            );
            return;
          }

          const validTo = cert.valid_to ? new Date(cert.valid_to) : null;
          const daysRemaining = validTo
            ? Math.ceil((validTo.getTime() - Date.now()) / 86_400_000)
            : null;
          const expired = daysRemaining !== null && daysRemaining < 0;

          resolve({
            status_code: null,
            response_time_ms: totalMs,
            is_up: !expired,
            error_message: expired ? 'CERTIFICATE_EXPIRED' : null,
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
              issuer: cert.issuer,
              subject: cert.subject,
              valid_from: cert.valid_from,
              valid_to: cert.valid_to,
              days_remaining: daysRemaining,
              fingerprint: cert.fingerprint,
              protocol: socket.getProtocol(),
              cipher: socket.getCipher(),
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
