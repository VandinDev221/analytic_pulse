import dns from 'dns/promises';
import type { CheckResult, DnsRecordAnswer, DnsRecordType } from '@analytic-pulse/shared';
import {
  failResult,
  resolveHost,
  type CheckableMonitor,
  type Checker,
} from './types';

export function normalizeDnsRecords(records: unknown): DnsRecordAnswer[] {
  if (!Array.isArray(records)) {
    if (records == null) return [];
    return [{ value: String(records) }];
  }

  return records.map((item) => {
    if (typeof item === 'string') return { value: item };
    if (Array.isArray(item)) return { value: item.join('') };
    if (item && typeof item === 'object') {
      const row = item as Record<string, unknown>;
      if ('exchange' in row) {
        return {
          value: String(row.exchange),
          priority: row.priority != null ? Number(row.priority) : null,
        };
      }
      if ('value' in row) {
        return {
          value: String(row.value),
          priority: row.priority != null ? Number(row.priority) : null,
        };
      }
      return { value: JSON.stringify(item) };
    }
    return { value: String(item) };
  });
}

export async function resolveDnsRecords(
  host: string,
  recordType: DnsRecordType
): Promise<unknown> {
  switch (recordType) {
    case 'A':
      return dns.resolve4(host);
    case 'AAAA':
      return dns.resolve6(host);
    case 'MX':
      return dns.resolveMx(host);
    case 'TXT':
      return dns.resolveTxt(host);
    case 'CNAME':
      return dns.resolveCname(host);
    case 'NS':
      return dns.resolveNs(host);
    case 'SPF': {
      const txt = await dns.resolveTxt(host);
      return txt.filter((parts) =>
        parts.join('').toLowerCase().startsWith('v=spf1')
      );
    }
    case 'DKIM': {
      const selectorHost = host.includes('._domainkey.')
        ? host
        : `default._domainkey.${host}`;
      return dns.resolveTxt(selectorHost);
    }
    case 'DMARC': {
      const dmarcHost = host.startsWith('_dmarc.') ? host : `_dmarc.${host}`;
      return dns.resolveTxt(dmarcHost);
    }
    case 'DNSSEC': {
      try {
        return await dns.resolve(host, 'DS');
      } catch {
        return dns.resolve(host, 'DNSKEY');
      }
    }
    default:
      return dns.resolve4(host);
  }
}

export class DnsChecker implements Checker {
  readonly type = 'dns';

  async check(monitor: CheckableMonitor): Promise<CheckResult> {
    const host = resolveHost(monitor);
    const recordType = (monitor.dns_record_type || 'A') as DnsRecordType;
    const start = Date.now();

    if (!host) {
      return failResult('dns', 0, 'Host is required for DNS check');
    }

    try {
      const raw = await resolveDnsRecords(host, recordType);
      const dnsMs = Date.now() - start;
      const records = normalizeDnsRecords(raw);

      if (records.length === 0) {
        return failResult('dns', dnsMs, `NO_${recordType}_RECORDS`, {
          dns_ms: dnsMs,
        });
      }

      const preview = records
        .slice(0, 5)
        .map((r) => (r.priority != null ? `${r.priority} ${r.value}` : r.value))
        .join(' · ');

      return {
        status_code: null,
        response_time_ms: dnsMs,
        is_up: true,
        error_message: null,
        check_type: 'dns',
        timings: {
          dns_ms: dnsMs,
          tcp_ms: null,
          tls_ms: null,
          ttfb_ms: null,
          download_ms: null,
          total_ms: dnsMs,
        },
        response_size_bytes: null,
        content_length: null,
        response_headers: null,
        redirect_chain: null,
        meta: {
          host,
          record_type: recordType,
          records,
          record_count: records.length,
          answers_preview: preview.slice(0, 500),
        },
      };
    } catch (error) {
      const dnsMs = Date.now() - start;
      const message =
        error instanceof Error ? error.message : 'DNS_RESOLUTION_FAILED';
      return failResult('dns', dnsMs, message, { dns_ms: dnsMs });
    }
  }
}
