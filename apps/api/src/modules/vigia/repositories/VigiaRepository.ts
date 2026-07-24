import type {
  VigiaAction,
  VigiaActionStatus,
  VigiaDigest,
  VigiaDigestSummary,
  VigiaMode,
  VigiaPlaybookId,
  VigiaPrediction,
  VigiaSeverity,
  VigiaStatus,
} from '@analytic-pulse/shared';
import { query } from '../../../infrastructure/db';
import { env } from '../../../config/env';

function toIso(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

export function mapAction(row: Record<string, unknown>): VigiaAction {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    playbook_id: (row.playbook_id as VigiaPlaybookId) || null,
    severity: (row.severity as VigiaSeverity) || 'info',
    status: (row.status as VigiaActionStatus) || 'proposed',
    title: row.title as string,
    explanation: (row.explanation as string) || null,
    target_type: (row.target_type as string) || null,
    target_id: (row.target_id as string) || null,
    input: (row.input as Record<string, unknown>) || {},
    result: (row.result as Record<string, unknown>) || {},
    created_at: toIso(row.created_at) || new Date().toISOString(),
    finished_at: toIso(row.finished_at),
  };
}

export function mapDigest(row: Record<string, unknown>): VigiaDigest {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    period_start: toIso(row.period_start) || new Date().toISOString(),
    period_end: toIso(row.period_end) || new Date().toISOString(),
    summary: (row.summary as VigiaDigestSummary) || emptySummary(),
    text_html: (row.text_html as string) || null,
    delivered_telegram: Boolean(row.delivered_telegram),
    created_at: toIso(row.created_at) || new Date().toISOString(),
  };
}

export function emptySummary(): VigiaDigestSummary {
  return {
    monitors_total: 0,
    monitors_down: 0,
    incidents_open: 0,
    incidents_resolved_24h: 0,
    ssl_critical: 0,
    agents_offline: 0,
    rum_errors_24h: 0,
    actions_24h: 0,
    predictions: [],
  };
}

export class VigiaRepository {
  async ensureSession(userId: string): Promise<void> {
    await query(
      `INSERT INTO vigia_sessions (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
  }

  async getSession(userId: string): Promise<Record<string, unknown> | null> {
    await this.ensureSession(userId);
    const r = await query(`SELECT * FROM vigia_sessions WHERE user_id = $1`, [
      userId,
    ]);
    return (r.rows[0] as Record<string, unknown>) || null;
  }

  async setMode(userId: string, mode: VigiaMode): Promise<void> {
    await this.ensureSession(userId);
    await query(
      `UPDATE vigia_sessions
       SET mode = $2, updated_at = TIMEZONE('utc', NOW())
       WHERE user_id = $1`,
      [userId, mode]
    );
  }

  async touchGreeting(userId: string): Promise<void> {
    await this.ensureSession(userId);
    await query(
      `UPDATE vigia_sessions
       SET last_greeting_at = TIMEZONE('utc', NOW()),
           updated_at = TIMEZONE('utc', NOW())
       WHERE user_id = $1`,
      [userId]
    );
  }

  async touchRound(userId: string): Promise<void> {
    await this.ensureSession(userId);
    await query(
      `UPDATE vigia_sessions
       SET last_round_at = TIMEZONE('utc', NOW()),
           updated_at = TIMEZONE('utc', NOW())
       WHERE user_id = $1`,
      [userId]
    );
  }

  async touchDigest(userId: string): Promise<void> {
    await this.ensureSession(userId);
    await query(
      `UPDATE vigia_sessions
       SET last_digest_at = TIMEZONE('utc', NOW()),
           updated_at = TIMEZONE('utc', NOW())
       WHERE user_id = $1`,
      [userId]
    );
  }

  async recordFailure(userId: string): Promise<{ openCircuit: boolean }> {
    await this.ensureSession(userId);
    const r = await query(
      `UPDATE vigia_sessions
       SET consecutive_failures = consecutive_failures + 1,
           circuit_open_until = CASE
             WHEN consecutive_failures + 1 >= 3
               THEN TIMEZONE('utc', NOW()) + INTERVAL '30 minutes'
             ELSE circuit_open_until
           END,
           updated_at = TIMEZONE('utc', NOW())
       WHERE user_id = $1
       RETURNING consecutive_failures, circuit_open_until`,
      [userId]
    );
    const row = r.rows[0] as Record<string, unknown>;
    return { openCircuit: Number(row.consecutive_failures) >= 3 };
  }

  async recordSuccess(userId: string): Promise<void> {
    await this.ensureSession(userId);
    await query(
      `UPDATE vigia_sessions
       SET consecutive_failures = 0,
           circuit_open_until = NULL,
           updated_at = TIMEZONE('utc', NOW())
       WHERE user_id = $1`,
      [userId]
    );
  }

  async buildStatus(userId: string): Promise<VigiaStatus> {
    const session = await this.getSession(userId);
    const lastRound = toIso(session?.last_round_at);
    const online =
      !!lastRound && Date.now() - new Date(lastRound).getTime() < 20 * 60_000;

    return {
      enabled: env.vigiaEnabled,
      mode: ((session?.mode as VigiaMode) || 'observe') as VigiaMode,
      auto_remediate: env.vigiaAutoRemediate,
      timezone: env.vigiaTz,
      last_greeting_at: toIso(session?.last_greeting_at),
      last_round_at: lastRound,
      last_digest_at: toIso(session?.last_digest_at),
      circuit_open_until: toIso(session?.circuit_open_until),
      consecutive_failures: Number(session?.consecutive_failures || 0),
      online,
    };
  }

  async insertAction(input: {
    userId: string;
    playbookId?: VigiaPlaybookId | null;
    severity: VigiaSeverity;
    status: VigiaActionStatus;
    title: string;
    explanation?: string;
    targetType?: string;
    targetId?: string;
    input?: Record<string, unknown>;
    result?: Record<string, unknown>;
    finished?: boolean;
  }): Promise<VigiaAction> {
    const r = await query(
      `INSERT INTO vigia_actions (
         user_id, playbook_id, severity, status, title, explanation,
         target_type, target_id, input, result, finished_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb,
         CASE WHEN $11 THEN TIMEZONE('utc', NOW()) ELSE NULL END
       )
       RETURNING *`,
      [
        input.userId,
        input.playbookId ?? null,
        input.severity,
        input.status,
        input.title,
        input.explanation ?? null,
        input.targetType ?? null,
        input.targetId ?? null,
        JSON.stringify(input.input ?? {}),
        JSON.stringify(input.result ?? {}),
        Boolean(input.finished),
      ]
    );
    return mapAction(r.rows[0] as Record<string, unknown>);
  }

  async updateAction(
    id: string,
    patch: {
      status: VigiaActionStatus;
      result?: Record<string, unknown>;
      explanation?: string;
    }
  ): Promise<VigiaAction | null> {
    const r = await query(
      `UPDATE vigia_actions
       SET status = $2,
           result = COALESCE($3::jsonb, result),
           explanation = COALESCE($4, explanation),
           finished_at = TIMEZONE('utc', NOW())
       WHERE id = $1
       RETURNING *`,
      [
        id,
        patch.status,
        patch.result ? JSON.stringify(patch.result) : null,
        patch.explanation ?? null,
      ]
    );
    if (!r.rows[0]) return null;
    return mapAction(r.rows[0] as Record<string, unknown>);
  }

  async listActions(userId: string, limit = 40): Promise<VigiaAction[]> {
    const r = await query(
      `SELECT * FROM vigia_actions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return (r.rows as Record<string, unknown>[]).map(mapAction);
  }

  async listProposed(userId: string, limit = 30): Promise<VigiaAction[]> {
    const r = await query(
      `SELECT * FROM vigia_actions
       WHERE user_id = $1 AND status = 'proposed'
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return (r.rows as Record<string, unknown>[]).map(mapAction);
  }

  async countActionsLastHour(userId: string): Promise<number> {
    const r = await query(
      `SELECT COUNT(*)::int AS c FROM vigia_actions
       WHERE user_id = $1
         AND playbook_id IS NOT NULL
         AND status IN ('running', 'succeeded', 'failed')
         AND created_at > TIMEZONE('utc', NOW()) - INTERVAL '1 hour'`,
      [userId]
    );
    return Number((r.rows[0] as { c: number }).c || 0);
  }

  async insertDigest(input: {
    userId: string;
    periodStart: Date;
    periodEnd: Date;
    summary: VigiaDigestSummary;
    textHtml: string;
    deliveredTelegram: boolean;
  }): Promise<VigiaDigest> {
    const r = await query(
      `INSERT INTO vigia_digests (
         user_id, period_start, period_end, summary, text_html, delivered_telegram
       ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       RETURNING *`,
      [
        input.userId,
        input.periodStart.toISOString(),
        input.periodEnd.toISOString(),
        JSON.stringify(input.summary),
        input.textHtml,
        input.deliveredTelegram,
      ]
    );
    return mapDigest(r.rows[0] as Record<string, unknown>);
  }

  async latestDigest(userId: string): Promise<VigiaDigest | null> {
    const r = await query(
      `SELECT * FROM vigia_digests
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );
    if (!r.rows[0]) return null;
    return mapDigest(r.rows[0] as Record<string, unknown>);
  }

  async insertRound(input: {
    userId: string;
    mode: VigiaMode;
    findings: number;
    actionsRun: number;
    meta?: Record<string, unknown>;
  }): Promise<void> {
    await query(
      `INSERT INTO vigia_rounds (
         user_id, mode, findings, actions_run, finished_at, meta
       ) VALUES ($1, $2, $3, $4, TIMEZONE('utc', NOW()), $5::jsonb)`,
      [
        input.userId,
        input.mode,
        input.findings,
        input.actionsRun,
        JSON.stringify(input.meta ?? {}),
      ]
    );
  }

  async listRounds(userId: string, limit = 12): Promise<
    Array<{
      id: string;
      user_id: string;
      started_at: string;
      finished_at: string | null;
      mode: VigiaMode;
      findings: number;
      actions_run: number;
      meta: Record<string, unknown>;
    }>
  > {
    const r = await query(
      `SELECT * FROM vigia_rounds
       WHERE user_id = $1
       ORDER BY started_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return (r.rows as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      user_id: row.user_id as string,
      started_at: toIso(row.started_at) || new Date().toISOString(),
      finished_at: toIso(row.finished_at),
      mode: row.mode as VigiaMode,
      findings: Number(row.findings || 0),
      actions_run: Number(row.actions_run || 0),
      meta: (row.meta as Record<string, unknown>) || {},
    }));
  }

  async listUserIds(): Promise<string[]> {
    const r = await query(`SELECT id FROM users`);
    return (r.rows as Array<{ id: string }>).map((u) => u.id);
  }

  async collectSummary(userId: string): Promise<VigiaDigestSummary> {
    const summary = emptySummary();

    try {
      const monitors = await query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'down')::int AS down
         FROM monitors WHERE user_id = $1`,
        [userId]
      );
      const m = monitors.rows[0] as { total: number; down: number };
      summary.monitors_total = Number(m.total || 0);
      summary.monitors_down = Number(m.down || 0);
    } catch {
      /* table missing */
    }

    try {
      const incidents = await query(
        `SELECT
           COUNT(*) FILTER (
             WHERE status IN ('open', 'acknowledged', 'investigating')
           )::int AS open_count,
           COUNT(*) FILTER (
             WHERE status = 'resolved'
               AND resolved_at > TIMEZONE('utc', NOW()) - INTERVAL '24 hours'
           )::int AS resolved_24h
         FROM incidents WHERE user_id = $1`,
        [userId]
      );
      const i = incidents.rows[0] as {
        open_count: number;
        resolved_24h: number;
      };
      summary.incidents_open = Number(i.open_count || 0);
      summary.incidents_resolved_24h = Number(i.resolved_24h || 0);
    } catch {
      /* */
    }

    try {
      const ssl = await query(
        `SELECT COUNT(*)::int AS c FROM monitors
         WHERE user_id = $1
           AND ssl_days_remaining IS NOT NULL
           AND ssl_days_remaining <= COALESCE(ssl_warn_days, 30)`,
        [userId]
      );
      summary.ssl_critical = Number(
        (ssl.rows[0] as { c: number }).c || 0
      );
    } catch {
      /* */
    }

    try {
      const agents = await query(
        `SELECT COUNT(*)::int AS c FROM agents
         WHERE user_id = $1
           AND status IN ('offline', 'pending')
           AND (
             last_seen_at IS NULL
             OR last_seen_at < TIMEZONE('utc', NOW()) - INTERVAL '5 minutes'
           )`,
        [userId]
      );
      summary.agents_offline = Number(
        (agents.rows[0] as { c: number }).c || 0
      );
    } catch {
      /* */
    }

    try {
      const rum = await query(
        `SELECT COUNT(*)::int AS c FROM rum_events
         WHERE user_id = $1
           AND event_type = 'error'
           AND created_at > TIMEZONE('utc', NOW()) - INTERVAL '24 hours'`,
        [userId]
      );
      summary.rum_errors_24h = Number((rum.rows[0] as { c: number }).c || 0);
    } catch {
      /* */
    }

    try {
      const actions = await query(
        `SELECT COUNT(*)::int AS c FROM vigia_actions
         WHERE user_id = $1
           AND created_at > TIMEZONE('utc', NOW()) - INTERVAL '24 hours'`,
        [userId]
      );
      summary.actions_24h = Number(
        (actions.rows[0] as { c: number }).c || 0
      );
    } catch {
      /* */
    }

    return summary;
  }

  async findDownMonitors(
    userId: string
  ): Promise<Array<{ id: string; name: string; url: string }>> {
    const r = await query(
      `SELECT id, name, url FROM monitors
       WHERE user_id = $1 AND status = 'down'
       ORDER BY updated_at DESC
       LIMIT 20`,
      [userId]
    );
    return r.rows as Array<{ id: string; name: string; url: string }>;
  }

  async findSslWarnings(
    userId: string
  ): Promise<
    Array<{ id: string; name: string; ssl_days_remaining: number }>
  > {
    const r = await query(
      `SELECT id, name, ssl_days_remaining
       FROM monitors
       WHERE user_id = $1
         AND ssl_days_remaining IS NOT NULL
         AND ssl_days_remaining <= COALESCE(ssl_warn_days, 30)
       ORDER BY ssl_days_remaining ASC
       LIMIT 20`,
      [userId]
    );
    return r.rows as Array<{
      id: string;
      name: string;
      ssl_days_remaining: number;
    }>;
  }

  async findStaleAgents(
    userId: string
  ): Promise<Array<{ id: string; name: string; status: string }>> {
    const r = await query(
      `SELECT id, name, status FROM agents
       WHERE user_id = $1
         AND status != 'disabled'
         AND (
           last_seen_at IS NULL
           OR last_seen_at < TIMEZONE('utc', NOW()) - INTERVAL '5 minutes'
         )
       LIMIT 20`,
      [userId]
    );
    return r.rows as Array<{ id: string; name: string; status: string }>;
  }

  async findOpenIncidents(
    userId: string
  ): Promise<Array<{ id: string; title: string; status: string; tags: string[] }>> {
    const r = await query(
      `SELECT id, title, status, COALESCE(tags, '{}') AS tags
       FROM incidents
       WHERE user_id = $1
         AND status IN ('open', 'acknowledged', 'investigating')
       ORDER BY opened_at DESC
       LIMIT 20`,
      [userId]
    );
    return r.rows as Array<{
      id: string;
      title: string;
      status: string;
      tags: string[];
    }>;
  }

  async markAgentOffline(agentId: string, userId: string): Promise<boolean> {
    const r = await query(
      `UPDATE agents
       SET status = 'offline', updated_at = TIMEZONE('utc', NOW())
       WHERE id = $1 AND user_id = $2 AND status != 'disabled'
       RETURNING id`,
      [agentId, userId]
    );
    return r.rowCount != null && r.rowCount > 0;
  }
}

export type { VigiaPrediction };
