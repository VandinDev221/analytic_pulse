import type {
  CreateMonitorInput,
  Monitor,
  MonitorMetrics,
  MonitorStatus,
  PingLog,
  UpdateMonitorInput,
} from '@analytic-pulse/shared';
import { query } from '../../../infrastructure/db';
import type { MonitorRepository } from './MonitorRepository';

export class PgMonitorRepository implements MonitorRepository {
  async create(userId: string, input: CreateMonitorInput): Promise<Monitor> {
    const result = await query(
      `INSERT INTO monitors (user_id, name, url, method, interval_minutes, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING *`,
      [
        userId,
        input.name,
        input.url,
        input.method ?? 'GET',
        input.interval_minutes ?? 5,
      ]
    );
    return result.rows[0] as Monitor;
  }

  async findAllByUser(userId: string): Promise<Monitor[]> {
    const result = await query(
      `SELECT * FROM monitors
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows as Monitor[];
  }

  async findByIdForUser(id: string, userId: string): Promise<Monitor | null> {
    const result = await query(
      `SELECT * FROM monitors
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return (result.rows[0] as Monitor | undefined) ?? null;
  }

  async update(
    id: string,
    userId: string,
    input: UpdateMonitorInput
  ): Promise<Monitor | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    const map: Array<[keyof UpdateMonitorInput, unknown]> = [
      ['name', input.name],
      ['url', input.url],
      ['method', input.method],
      ['interval_minutes', input.interval_minutes],
      ['status', input.status],
    ];

    for (const [key, value] of map) {
      if (value !== undefined) {
        fields.push(`${key} = $${index++}`);
        values.push(value);
      }
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

    return (result.rows[0] as Monitor | undefined) ?? null;
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
    Array<Pick<Monitor, 'id' | 'user_id' | 'name' | 'url' | 'status'>>
  > {
    const result = await query(
      `SELECT id, user_id, name, url, status FROM monitors
       WHERE status != 'inactive'`
    );
    return result.rows as Array<
      Pick<Monitor, 'id' | 'user_id' | 'name' | 'url' | 'status'>
    >;
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

  async insertPingLog(
    monitorId: string,
    log: {
      status_code: number | null;
      response_time_ms: number;
      is_up: boolean;
      error_message: string | null;
    }
  ): Promise<void> {
    await query(
      `INSERT INTO ping_logs (monitor_id, status_code, response_time_ms, is_up, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        monitorId,
        log.status_code,
        log.response_time_ms,
        log.is_up,
        log.error_message,
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
        'response_time_ms' | 'is_up' | 'created_at' | 'status_code' | 'error_message'
      >
    >
  > {
    const result = await query(
      `SELECT response_time_ms, is_up, created_at, status_code, error_message
       FROM ping_logs
       WHERE monitor_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [monitorId, limit]
    );
    return result.rows as Array<
      Pick<
        PingLog,
        'response_time_ms' | 'is_up' | 'created_at' | 'status_code' | 'error_message'
      >
    >;
  }
}
