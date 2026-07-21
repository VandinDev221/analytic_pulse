import type {
  AlertChannel,
  AlertRule,
  CreateAlertChannelInput,
  CreateAlertRuleInput,
  UpdateAlertChannelInput,
  UpdateAlertRuleInput,
} from '@analytic-pulse/shared';
import { query } from '../../../infrastructure/db';
import {
  mapChannel,
  type AlertChannelRepository,
  type AlertRuleRepository,
  toIso,
} from './types';

async function loadRuleChannels(ruleId: string) {
  const result = await query(
    `SELECT arc.channel_id, arc.escalation_step, arc.delay_seconds,
            c.id, c.user_id, c.name, c.kind, c.config, c.is_enabled,
            c.created_at, c.updated_at
     FROM alert_rule_channels arc
     INNER JOIN alert_channels c ON c.id = arc.channel_id
     WHERE arc.rule_id = $1
     ORDER BY arc.escalation_step ASC, c.name ASC`,
    [ruleId]
  );
  return result.rows.map((row) => ({
    channel_id: row.channel_id as string,
    escalation_step: Number(row.escalation_step),
    delay_seconds: Number(row.delay_seconds),
    channel: mapChannel(row),
  }));
}

function mapRule(
  row: Record<string, unknown>,
  channels: AlertRule['channels']
): AlertRule {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    is_enabled: Boolean(row.is_enabled),
    monitor_id: (row.monitor_id as string | null) ?? null,
    metric: row.metric as AlertRule['metric'],
    operator: row.operator as AlertRule['operator'],
    threshold: row.threshold != null ? Number(row.threshold) : null,
    for_seconds: Number(row.for_seconds ?? 0),
    severity: row.severity as AlertRule['severity'],
    cooldown_seconds: Number(row.cooldown_seconds ?? 900),
    max_retries: Number(row.max_retries ?? 3),
    retry_backoff_seconds: Number(row.retry_backoff_seconds ?? 60),
    priority: Number(row.priority ?? 0),
    created_at: toIso(row.created_at as Date | string)!,
    updated_at: toIso(row.updated_at as Date | string)!,
    channels,
  };
}

export class PgAlertChannelRepository implements AlertChannelRepository {
  async listByUser(userId: string): Promise<AlertChannel[]> {
    const result = await query(
      `SELECT * FROM alert_channels WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows.map((row) => mapChannel(row));
  }

  async findByIdForUser(
    id: string,
    userId: string
  ): Promise<AlertChannel | null> {
    const result = await query(
      `SELECT * FROM alert_channels WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return result.rows[0] ? mapChannel(result.rows[0]) : null;
  }

  async create(
    userId: string,
    input: CreateAlertChannelInput
  ): Promise<AlertChannel> {
    const result = await query(
      `INSERT INTO alert_channels (user_id, name, kind, config, is_enabled)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       RETURNING *`,
      [
        userId,
        input.name,
        input.kind,
        JSON.stringify(input.config ?? {}),
        input.is_enabled ?? true,
      ]
    );
    return mapChannel(result.rows[0]);
  }

  async update(
    id: string,
    userId: string,
    input: UpdateAlertChannelInput
  ): Promise<AlertChannel | null> {
    const fields: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let i = 1;

    if (input.name !== undefined) {
      fields.push(`name = $${i++}`);
      values.push(input.name);
    }
    if (input.kind !== undefined) {
      fields.push(`kind = $${i++}`);
      values.push(input.kind);
    }
    if (input.config !== undefined) {
      fields.push(`config = $${i++}::jsonb`);
      values.push(JSON.stringify(input.config));
    }
    if (input.is_enabled !== undefined) {
      fields.push(`is_enabled = $${i++}`);
      values.push(input.is_enabled);
    }

    values.push(id, userId);
    const result = await query(
      `UPDATE alert_channels SET ${fields.join(', ')}
       WHERE id = $${i++} AND user_id = $${i}
       RETURNING *`,
      values
    );
    return result.rows[0] ? mapChannel(result.rows[0]) : null;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await query(
      `DELETE FROM alert_channels WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }
}

export class PgAlertRuleRepository implements AlertRuleRepository {
  async listByUser(userId: string): Promise<AlertRule[]> {
    const result = await query(
      `SELECT * FROM alert_rules WHERE user_id = $1 ORDER BY priority DESC, created_at DESC`,
      [userId]
    );
    const rules: AlertRule[] = [];
    for (const row of result.rows) {
      rules.push(mapRule(row, await loadRuleChannels(row.id)));
    }
    return rules;
  }

  async listEnabledForMonitor(
    userId: string,
    monitorId: string
  ): Promise<AlertRule[]> {
    const result = await query(
      `SELECT * FROM alert_rules
       WHERE user_id = $1
         AND is_enabled = true
         AND (monitor_id IS NULL OR monitor_id = $2)
       ORDER BY priority DESC`,
      [userId, monitorId]
    );
    const rules: AlertRule[] = [];
    for (const row of result.rows) {
      rules.push(mapRule(row, await loadRuleChannels(row.id)));
    }
    return rules;
  }

  async findByIdForUser(
    id: string,
    userId: string
  ): Promise<AlertRule | null> {
    const result = await query(
      `SELECT * FROM alert_rules WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (!result.rows[0]) return null;
    return mapRule(result.rows[0], await loadRuleChannels(id));
  }

  async create(
    userId: string,
    input: CreateAlertRuleInput
  ): Promise<AlertRule> {
    const result = await query(
      `INSERT INTO alert_rules (
         user_id, name, is_enabled, monitor_id, metric, operator, threshold,
         for_seconds, severity, cooldown_seconds, max_retries,
         retry_backoff_seconds, priority
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        userId,
        input.name,
        input.is_enabled ?? true,
        input.monitor_id ?? null,
        input.metric,
        input.operator,
        input.threshold ?? null,
        input.for_seconds ?? 0,
        input.severity ?? 'major',
        input.cooldown_seconds ?? 900,
        input.max_retries ?? 3,
        input.retry_backoff_seconds ?? 60,
        input.priority ?? 0,
      ]
    );
    const ruleId = result.rows[0].id as string;
    await this.replaceChannels(ruleId, input.channels);
    return mapRule(result.rows[0], await loadRuleChannels(ruleId));
  }

  async update(
    id: string,
    userId: string,
    input: UpdateAlertRuleInput
  ): Promise<AlertRule | null> {
    const fields: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let i = 1;

    const scalars: Array<[string, unknown]> = [
      ['name', input.name],
      ['is_enabled', input.is_enabled],
      ['monitor_id', input.monitor_id],
      ['metric', input.metric],
      ['operator', input.operator],
      ['threshold', input.threshold],
      ['for_seconds', input.for_seconds],
      ['severity', input.severity],
      ['cooldown_seconds', input.cooldown_seconds],
      ['max_retries', input.max_retries],
      ['retry_backoff_seconds', input.retry_backoff_seconds],
      ['priority', input.priority],
    ];

    for (const [key, value] of scalars) {
      if (value !== undefined) {
        fields.push(`${key} = $${i++}`);
        values.push(value);
      }
    }

    values.push(id, userId);
    const result = await query(
      `UPDATE alert_rules SET ${fields.join(', ')}
       WHERE id = $${i++} AND user_id = $${i}
       RETURNING *`,
      values
    );
    if (!result.rows[0]) return null;

    if (input.channels) {
      await this.replaceChannels(id, input.channels);
    }

    return mapRule(result.rows[0], await loadRuleChannels(id));
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await query(
      `DELETE FROM alert_rules WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async countEnabledByUser(userId: string): Promise<number> {
    const result = await query(
      `SELECT COUNT(*)::int AS count FROM alert_rules
       WHERE user_id = $1 AND is_enabled = true`,
      [userId]
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  private async replaceChannels(
    ruleId: string,
    channels: Array<{
      channel_id: string;
      escalation_step?: number;
      delay_seconds?: number;
    }>
  ): Promise<void> {
    await query(`DELETE FROM alert_rule_channels WHERE rule_id = $1`, [ruleId]);
    for (const ch of channels) {
      await query(
        `INSERT INTO alert_rule_channels (rule_id, channel_id, escalation_step, delay_seconds)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [
          ruleId,
          ch.channel_id,
          ch.escalation_step ?? 0,
          ch.delay_seconds ?? 0,
        ]
      );
    }
  }
}
