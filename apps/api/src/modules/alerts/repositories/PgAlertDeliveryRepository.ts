import type { AlertDelivery } from '@analytic-pulse/shared';
import { query } from '../../../infrastructure/db';
import {
  mapDelivery,
  type AlertDeliveryRepository,
} from './types';

export class PgAlertDeliveryRepository implements AlertDeliveryRepository {
  async enqueue(input: {
    ruleId: string;
    channelId: string;
    monitorId: string | null;
    fingerprint: string;
    escalationStep: number;
    payload: Record<string, unknown>;
    scheduledAt?: Date;
  }): Promise<AlertDelivery> {
    const result = await query(
      `INSERT INTO alert_deliveries (
         rule_id, channel_id, monitor_id, fingerprint, escalation_step,
         payload, scheduled_at, status
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,'pending')
       RETURNING *`,
      [
        input.ruleId,
        input.channelId,
        input.monitorId,
        input.fingerprint,
        input.escalationStep,
        JSON.stringify(input.payload),
        input.scheduledAt ?? new Date(),
      ]
    );
    return mapDelivery(result.rows[0]);
  }

  async findDue(limit = 50): Promise<AlertDelivery[]> {
    const result = await query(
      `SELECT * FROM alert_deliveries
       WHERE status = 'pending' AND scheduled_at <= NOW()
       ORDER BY scheduled_at ASC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map((row) => mapDelivery(row));
  }

  async markSent(id: string): Promise<void> {
    await query(
      `UPDATE alert_deliveries
       SET status = 'sent', fired_at = NOW(), updated_at = NOW(), last_error = NULL
       WHERE id = $1`,
      [id]
    );
  }

  async markFailed(
    id: string,
    error: string,
    nextAttempt?: Date | null
  ): Promise<void> {
    if (nextAttempt) {
      await query(
        `UPDATE alert_deliveries
         SET status = 'pending',
             attempt = attempt + 1,
             last_error = $2,
             scheduled_at = $3,
             updated_at = NOW()
         WHERE id = $1`,
        [id, error.substring(0, 500), nextAttempt]
      );
      return;
    }

    await query(
      `UPDATE alert_deliveries
       SET status = 'failed',
           attempt = attempt + 1,
           last_error = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [id, error.substring(0, 500)]
    );
  }

  async markSuppressed(id: string, reason: string): Promise<void> {
    await query(
      `UPDATE alert_deliveries
       SET status = 'suppressed', last_error = $2, updated_at = NOW()
       WHERE id = $1`,
      [id, reason.substring(0, 500)]
    );
  }

  async lastSentAt(fingerprint: string): Promise<Date | null> {
    const result = await query(
      `SELECT fired_at FROM alert_deliveries
       WHERE fingerprint = $1 AND status = 'sent' AND fired_at IS NOT NULL
       ORDER BY fired_at DESC
       LIMIT 1`,
      [fingerprint]
    );
    const value = result.rows[0]?.fired_at;
    return value ? new Date(value) : null;
  }

  async listRecentByUser(
    userId: string,
    limit = 50
  ): Promise<AlertDelivery[]> {
    const result = await query(
      `SELECT d.*
       FROM alert_deliveries d
       INNER JOIN alert_rules r ON r.id = d.rule_id
       WHERE r.user_id = $1
       ORDER BY d.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows.map((row) => mapDelivery(row));
  }
}
