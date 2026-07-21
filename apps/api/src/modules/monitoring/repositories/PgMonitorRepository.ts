import type {
  CheckResult,
  CreateMonitorInput,
  Monitor,
  MonitorMetrics,
  MonitorStatus,
  PingLog,
  UpdateMonitorInput,
} from '@analytic-pulse/shared';
import { query } from '../../../infrastructure/db';
import type { CheckableMonitor } from '../checkers';
import type { MonitorRepository } from './MonitorRepository';

function mapMonitor(row: Record<string, unknown>): Monitor {
  return {
    ...(row as unknown as Monitor),
    expected_status_codes: Array.isArray(row.expected_status_codes)
      ? (row.expected_status_codes as number[])
      : row.expected_status_codes
        ? (row.expected_status_codes as number[])
        : null,
    request_headers:
      row.request_headers && typeof row.request_headers === 'object'
        ? (row.request_headers as Record<string, string>)
        : null,
    check_type: (row.check_type as Monitor['check_type']) || 'http',
  };
}

export class PgMonitorRepository implements MonitorRepository {
  async create(userId: string, input: CreateMonitorInput): Promise<Monitor> {
    const result = await query(
      `INSERT INTO monitors (
         user_id, name, url, method, interval_minutes, status, check_type,
         host, port, dns_record_type, keyword, expected_status_codes,
         expected_header_name, expected_header_value, json_path, json_expected,
         request_headers, request_body
       ) VALUES (
         $1,$2,$3,$4,$5,'active',$6,
         $7,$8,$9,$10,$11::jsonb,
         $12,$13,$14,$15,
         $16::jsonb,$17
       )
       RETURNING *`,
      [
        userId,
        input.name,
        input.url,
        input.method ?? 'GET',
        input.interval_minutes ?? 5,
        input.check_type ?? 'http',
        input.host ?? null,
        input.port ?? null,
        input.dns_record_type ?? 'A',
        input.keyword ?? null,
        JSON.stringify(input.expected_status_codes ?? [200, 201, 202, 204, 301, 302, 304]),
        input.expected_header_name ?? null,
        input.expected_header_value ?? null,
        input.json_path ?? null,
        input.json_expected ?? null,
        JSON.stringify(input.request_headers ?? {}),
        input.request_body ?? null,
      ]
    );
    return mapMonitor(result.rows[0]);
  }

  async findAllByUser(userId: string): Promise<Monitor[]> {
    const result = await query(
      `SELECT * FROM monitors
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows.map((row) => mapMonitor(row));
  }

  async findByIdForUser(id: string, userId: string): Promise<Monitor | null> {
    const result = await query(
      `SELECT * FROM monitors
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return result.rows[0] ? mapMonitor(result.rows[0]) : null;
  }

  async update(
    id: string,
    userId: string,
    input: UpdateMonitorInput
  ): Promise<Monitor | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    const scalarMap: Array<[keyof UpdateMonitorInput, unknown]> = [
      ['name', input.name],
      ['url', input.url],
      ['method', input.method],
      ['interval_minutes', input.interval_minutes],
      ['status', input.status],
      ['check_type', input.check_type],
      ['host', input.host],
      ['port', input.port],
      ['dns_record_type', input.dns_record_type],
      ['keyword', input.keyword],
      ['expected_header_name', input.expected_header_name],
      ['expected_header_value', input.expected_header_value],
      ['json_path', input.json_path],
      ['json_expected', input.json_expected],
      ['request_body', input.request_body],
    ];

    for (const [key, value] of scalarMap) {
      if (value !== undefined) {
        fields.push(`${key} = $${index++}`);
        values.push(value);
      }
    }

    if (input.expected_status_codes !== undefined) {
      fields.push(`expected_status_codes = $${index++}::jsonb`);
      values.push(JSON.stringify(input.expected_status_codes));
    }

    if (input.request_headers !== undefined) {
      fields.push(`request_headers = $${index++}::jsonb`);
      values.push(JSON.stringify(input.request_headers));
    }

    if (fields.length === 0) {
      return this.findByIdForUser(id, userId);
    }

    values.push(id);
    const idIndex = index++;
    values.push(userId);
    const userIndex = index++;

    const result = await query(
      `UPDATE monitors
       SET ${fields.join(', ')}
       WHERE id = $${idIndex} AND user_id = $${userIndex}
       RETURNING *`,
      values
    );

    return result.rows[0] ? mapMonitor(result.rows[0]) : null;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await query(
      `DELETE FROM monitors
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findDueForCheck(): Promise<
    Array<CheckableMonitor & { user_id: string; status: MonitorStatus }>
  > {
    const result = await query(
      `SELECT id, user_id, name, url, method, status, check_type,
              host, port, dns_record_type, keyword, expected_status_codes,
              expected_header_name, expected_header_value, json_path, json_expected,
              request_headers, request_body
       FROM monitors
       WHERE status != 'inactive'`
    );
    return result.rows.map((row) => {
      const mapped = mapMonitor(row);
      return {
        ...mapped,
        user_id: mapped.user_id,
        status: mapped.status,
      };
    });
  }

  async updateCheckResult(
    id: string,
    status: Extract<MonitorStatus, 'up' | 'down'>,
    responseTimeMs: number
  ): Promise<void> {
    await query(
      `UPDATE monitors
       SET status = $1, last_checked_at = NOW(), last_response_time_ms = $2
       WHERE id = $3`,
      [status, responseTimeMs, id]
    );
  }

  async insertPingLog(monitorId: string, result: CheckResult): Promise<void> {
    await query(
      `INSERT INTO ping_logs (
         monitor_id, status_code, response_time_ms, is_up, error_message,
         check_type, dns_ms, tcp_ms, tls_ms, ttfb_ms, download_ms,
         response_size_bytes, content_length, response_headers, redirect_chain
       ) VALUES (
         $1,$2,$3,$4,$5,
         $6,$7,$8,$9,$10,$11,
         $12,$13,$14::jsonb,$15::jsonb
       )`,
      [
        monitorId,
        result.status_code,
        result.response_time_ms,
        result.is_up,
        result.error_message,
        result.check_type,
        result.timings.dns_ms,
        result.timings.tcp_ms,
        result.timings.tls_ms,
        result.timings.ttfb_ms,
        result.timings.download_ms,
        result.response_size_bytes,
        result.content_length,
        result.response_headers ? JSON.stringify(result.response_headers) : null,
        result.redirect_chain ? JSON.stringify(result.redirect_chain) : null,
      ]
    );
  }

  async getMetrics(monitorId: string): Promise<MonitorMetrics | null> {
    const result = await query(`SELECT * FROM get_monitor_metrics($1)`, [
      monitorId,
    ]);
    return (result.rows[0] as MonitorMetrics | undefined) ?? null;
  }

  async getRecentLogs(
    monitorId: string,
    limit = 100
  ): Promise<
    Array<
      Pick<
        PingLog,
        | 'response_time_ms'
        | 'is_up'
        | 'created_at'
        | 'status_code'
        | 'error_message'
        | 'check_type'
        | 'dns_ms'
        | 'tcp_ms'
        | 'tls_ms'
        | 'ttfb_ms'
        | 'download_ms'
        | 'response_size_bytes'
        | 'content_length'
        | 'redirect_chain'
      >
    >
  > {
    const result = await query(
      `SELECT response_time_ms, is_up, created_at, status_code, error_message,
              check_type, dns_ms, tcp_ms, tls_ms, ttfb_ms, download_ms,
              response_size_bytes, content_length, redirect_chain
       FROM ping_logs
       WHERE monitor_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [monitorId, limit]
    );
    return result.rows as Array<
      Pick<
        PingLog,
        | 'response_time_ms'
        | 'is_up'
        | 'created_at'
        | 'status_code'
        | 'error_message'
        | 'check_type'
        | 'dns_ms'
        | 'tcp_ms'
        | 'tls_ms'
        | 'ttfb_ms'
        | 'download_ms'
        | 'response_size_bytes'
        | 'content_length'
        | 'redirect_chain'
      >
    >;
  }
}
