import type {
  DnsDomainScan,
  DnsMonitorRow,
  DnsOverview,
  DnsRecordAnswer,
  DnsRecordType,
  DnsTypeResult,
  MonitorStatus,
} from '@analytic-pulse/shared';
import { ValidationError } from '@analytic-pulse/shared';
import { query } from '../../../infrastructure/db';
import {
  normalizeDnsRecords,
  resolveDnsRecords,
} from '../../monitoring/checkers/DnsChecker';

const SCAN_TYPES: DnsRecordType[] = [
  'A',
  'AAAA',
  'MX',
  'TXT',
  'CNAME',
  'NS',
  'SPF',
  'DKIM',
  'DMARC',
  'DNSSEC',
];

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  return new Date(value).toISOString();
}

function parseRecords(raw: unknown): DnsRecordAnswer[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return normalizeDnsRecords(raw);
  if (typeof raw === 'string') {
    try {
      return normalizeDnsRecords(JSON.parse(raw));
    } catch {
      return [{ value: raw }];
    }
  }
  return normalizeDnsRecords(raw);
}

export class DnsService {
  async getOverview(userId: string): Promise<DnsOverview> {
    let rows: Array<Record<string, unknown>> = [];

    try {
      const result = await query(
        `SELECT id, name, host, url, status, dns_record_type,
                dns_last_records, dns_record_count, dns_answers_preview,
                dns_resolved_at, last_checked_at, last_response_time_ms
         FROM monitors
         WHERE user_id = $1
           AND check_type = 'dns'
           AND status != 'inactive'
         ORDER BY name ASC`,
        [userId]
      );
      rows = result.rows as Array<Record<string, unknown>>;
    } catch {
      const result = await query(
        `SELECT id, name, host, url, status, dns_record_type,
                last_checked_at, last_response_time_ms
         FROM monitors
         WHERE user_id = $1
           AND check_type = 'dns'
           AND status != 'inactive'
         ORDER BY name ASC`,
        [userId]
      );
      rows = result.rows as Array<Record<string, unknown>>;
    }

    const monitors: DnsMonitorRow[] = rows.map((row) => {
      const host =
        (row.host as string | null) ||
        String(row.url || '')
          .replace(/^(dns|https?):\/\//i, '')
          .split('/')[0] ||
        null;
      const records = parseRecords(row.dns_last_records);
      return {
        monitor_id: String(row.id),
        name: String(row.name),
        host,
        record_type: (row.dns_record_type as DnsRecordType) || 'A',
        status: row.status as MonitorStatus,
        record_count:
          row.dns_record_count != null
            ? Number(row.dns_record_count)
            : records.length || null,
        answers_preview: (row.dns_answers_preview as string | null) ?? null,
        records,
        last_checked_at: toIso(row.last_checked_at as Date | string | null),
        last_response_time_ms:
          row.last_response_time_ms != null
            ? Number(row.last_response_time_ms)
            : null,
        resolved_at: toIso(row.dns_resolved_at as Date | string | null),
      };
    });

    const byType: Partial<Record<DnsRecordType, number>> = {};
    for (const m of monitors) {
      byType[m.record_type] = (byType[m.record_type] ?? 0) + 1;
    }

    return {
      summary: {
        total: monitors.length,
        up: monitors.filter((m) => m.status === 'up').length,
        down: monitors.filter((m) => m.status === 'down').length,
        by_type: byType,
      },
      monitors,
    };
  }

  async scanDomain(hostRaw: string): Promise<DnsDomainScan> {
    const host = hostRaw
      .trim()
      .toLowerCase()
      .replace(/^(https?:\/\/)?/, '')
      .split('/')[0]
      ?.replace(/\.$/, '');

    if (!host || !/^[a-z0-9._-]+$/i.test(host)) {
      throw new ValidationError('Informe um hostname válido');
    }

    const results: DnsTypeResult[] = await Promise.all(
      SCAN_TYPES.map(async (type) => {
        const start = Date.now();
        try {
          const raw = await resolveDnsRecords(host, type);
          const records = normalizeDnsRecords(raw);
          return {
            type,
            ok: records.length > 0,
            records,
            error: records.length === 0 ? `NO_${type}_RECORDS` : null,
            latency_ms: Date.now() - start,
          };
        } catch (error) {
          return {
            type,
            ok: false,
            records: [],
            error: error instanceof Error ? error.message : 'DNS_FAILED',
            latency_ms: Date.now() - start,
          };
        }
      })
    );

    const find = (t: DnsRecordType) => results.find((r) => r.type === t);

    return {
      host,
      scanned_at: new Date().toISOString(),
      results,
      email_auth: {
        spf: find('SPF')?.ok ?? false,
        dkim: find('DKIM')?.ok ?? false,
        dmarc: find('DMARC')?.ok ?? false,
        dnssec: find('DNSSEC')?.ok ?? false,
      },
    };
  }
}
