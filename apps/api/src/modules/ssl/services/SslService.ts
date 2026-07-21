import type {
  MonitorStatus,
  SslHealthStatus,
  SslMonitorRow,
  SslOverview,
} from '@analytic-pulse/shared';
import { query } from '../../../infrastructure/db';

function healthFromDays(
  days: number | null,
  warnDays: number,
  status: MonitorStatus
): SslHealthStatus {
  if (days == null) return status === 'down' ? 'expired' : 'unknown';
  if (days < 0) return 'expired';
  if (days <= 7) return 'critical';
  if (days <= warnDays) return 'warning';
  return 'ok';
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  return new Date(value).toISOString();
}

export class SslService {
  async getOverview(userId: string): Promise<SslOverview> {
    let rows: Array<Record<string, unknown>> = [];

    try {
      const result = await query(
        `SELECT id, name, host, port, url, status,
                ssl_issuer, ssl_subject, ssl_valid_from, ssl_valid_to,
                ssl_days_remaining, ssl_protocol, ssl_cipher, ssl_fingerprint,
                ssl_warn_days, last_checked_at, last_response_time_ms
         FROM monitors
         WHERE user_id = $1
           AND check_type = 'ssl'
           AND status != 'inactive'
         ORDER BY
           CASE
             WHEN ssl_days_remaining IS NULL THEN 9999
             ELSE ssl_days_remaining
           END ASC,
           name ASC`,
        [userId]
      );
      rows = result.rows as Array<Record<string, unknown>>;
    } catch {
      const result = await query(
        `SELECT id, name, host, port, url, status,
                last_checked_at, last_response_time_ms
         FROM monitors
         WHERE user_id = $1
           AND check_type = 'ssl'
           AND status != 'inactive'
         ORDER BY name ASC`,
        [userId]
      );
      rows = result.rows as Array<Record<string, unknown>>;
    }

    const certificates: SslMonitorRow[] = rows.map((row) => {
      const warnDays = Number(row.ssl_warn_days ?? 30);
      const days =
        row.ssl_days_remaining != null ? Number(row.ssl_days_remaining) : null;
      const status = row.status as MonitorStatus;
      return {
        monitor_id: String(row.id),
        name: String(row.name),
        host: (row.host as string | null) ?? null,
        port: row.port != null ? Number(row.port) : null,
        status,
        warn_days: warnDays,
        health: healthFromDays(days, warnDays, status),
        issuer: (row.ssl_issuer as string | null) ?? null,
        subject: (row.ssl_subject as string | null) ?? null,
        valid_from: toIso(row.ssl_valid_from as Date | string | null),
        valid_to: toIso(row.ssl_valid_to as Date | string | null),
        days_remaining: days,
        protocol: (row.ssl_protocol as string | null) ?? null,
        cipher: (row.ssl_cipher as string | null) ?? null,
        fingerprint: (row.ssl_fingerprint as string | null) ?? null,
        last_checked_at: toIso(row.last_checked_at as Date | string | null),
        last_response_time_ms:
          row.last_response_time_ms != null
            ? Number(row.last_response_time_ms)
            : null,
      };
    });

    const summary = {
      total: certificates.length,
      ok: certificates.filter((c) => c.health === 'ok').length,
      warning: certificates.filter((c) => c.health === 'warning').length,
      critical: certificates.filter((c) => c.health === 'critical').length,
      expired: certificates.filter((c) => c.health === 'expired').length,
      unknown: certificates.filter((c) => c.health === 'unknown').length,
    };

    return { summary, certificates };
  }
}
