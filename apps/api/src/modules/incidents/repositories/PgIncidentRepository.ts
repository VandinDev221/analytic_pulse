import type {
  AffectedMonitor,
  IncidentComment,
  IncidentTimelineEvent,
  IncidentTimelineEventType,
  UpdateIncidentInput,
} from '@analytic-pulse/shared';
import { query } from '../../../infrastructure/db';
import {
  type IncidentRepository,
  type IncidentRow,
  toIso,
} from './IncidentRepository';

function mapTimeline(row: Record<string, unknown>): IncidentTimelineEvent {
  return {
    id: row.id as string,
    incident_id: row.incident_id as string,
    event_type: row.event_type as IncidentTimelineEventType,
    message: row.message as string,
    actor_user_id: (row.actor_user_id as string | null) ?? null,
    metadata:
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: toIso(row.created_at as Date | string)!,
  };
}

function mapComment(row: Record<string, unknown>): IncidentComment {
  return {
    id: row.id as string,
    incident_id: row.incident_id as string,
    user_id: row.user_id as string,
    body: row.body as string,
    created_at: toIso(row.created_at as Date | string)!,
    updated_at: toIso(row.updated_at as Date | string)!,
    author_email: (row.author_email as string | null) ?? null,
  };
}

export class PgIncidentRepository implements IncidentRepository {
  async create(input: {
    userId: string;
    title: string;
    severity?: string;
    monitorIds: string[];
    tags?: string[];
  }): Promise<IncidentRow> {
    const result = await query(
      `INSERT INTO incidents (user_id, title, severity, tags, status)
       VALUES ($1, $2, $3, $4, 'open')
       RETURNING *`,
      [
        input.userId,
        input.title,
        input.severity ?? 'major',
        input.tags ?? [],
      ]
    );
    const incident = result.rows[0] as IncidentRow;

    for (const monitorId of input.monitorIds) {
      await this.attachMonitor(incident.id, monitorId);
    }

    return incident;
  }

  async findOpenByMonitor(monitorId: string): Promise<IncidentRow | null> {
    const result = await query(
      `SELECT i.*
       FROM incidents i
       INNER JOIN incident_monitors im ON im.incident_id = i.id
       WHERE im.monitor_id = $1
         AND i.status IN ('open', 'acknowledged', 'investigating')
       ORDER BY i.opened_at DESC
       LIMIT 1`,
      [monitorId]
    );
    return (result.rows[0] as IncidentRow | undefined) ?? null;
  }

  async findByIdForUser(
    id: string,
    userId: string
  ): Promise<IncidentRow | null> {
    const result = await query(
      `SELECT * FROM incidents WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return (result.rows[0] as IncidentRow | undefined) ?? null;
  }

  async listByUser(
    userId: string,
    filters?: { status?: string }
  ): Promise<IncidentRow[]> {
    const status = filters?.status ?? 'active';

    if (status === 'all') {
      const result = await query(
        `SELECT * FROM incidents
         WHERE user_id = $1
         ORDER BY opened_at DESC
         LIMIT 200`,
        [userId]
      );
      return result.rows as IncidentRow[];
    }

    if (status === 'active') {
      const result = await query(
        `SELECT * FROM incidents
         WHERE user_id = $1
           AND status IN ('open', 'acknowledged', 'investigating')
         ORDER BY opened_at DESC
         LIMIT 200`,
        [userId]
      );
      return result.rows as IncidentRow[];
    }

    const result = await query(
      `SELECT * FROM incidents
       WHERE user_id = $1 AND status = $2
       ORDER BY opened_at DESC
       LIMIT 200`,
      [userId, status]
    );
    return result.rows as IncidentRow[];
  }

  async update(
    id: string,
    userId: string,
    input: UpdateIncidentInput & {
      acknowledged_at?: string | Date | null;
      acknowledged_by?: string | null;
      recovered_at?: string | Date | null;
      resolved_at?: string | Date | null;
      resolved_by?: string | null;
    }
  ): Promise<IncidentRow | null> {
    const fields: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let index = 1;

    const map: Array<[string, unknown]> = [
      ['title', input.title],
      ['severity', input.severity],
      ['root_cause', input.root_cause],
      ['notes', input.notes],
      ['status', input.status],
      ['acknowledged_at', input.acknowledged_at],
      ['acknowledged_by', input.acknowledged_by],
      ['recovered_at', input.recovered_at],
      ['resolved_at', input.resolved_at],
      ['resolved_by', input.resolved_by],
    ];

    for (const [key, value] of map) {
      if (value !== undefined) {
        fields.push(`${key} = $${index++}`);
        values.push(value);
      }
    }

    if (input.tags !== undefined) {
      fields.push(`tags = $${index++}`);
      values.push(input.tags);
    }

    values.push(id);
    const idIndex = index++;
    values.push(userId);
    const userIndex = index++;

    const result = await query(
      `UPDATE incidents
       SET ${fields.join(', ')}
       WHERE id = $${idIndex} AND user_id = $${userIndex}
       RETURNING *`,
      values
    );

    return (result.rows[0] as IncidentRow | undefined) ?? null;
  }

  async attachMonitor(incidentId: string, monitorId: string): Promise<void> {
    await query(
      `INSERT INTO incident_monitors (incident_id, monitor_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [incidentId, monitorId]
    );
  }

  async getAffectedMonitors(incidentId: string): Promise<AffectedMonitor[]> {
    const result = await query(
      `SELECT m.id, m.name, m.url, m.status, m.check_type
       FROM monitors m
       INNER JOIN incident_monitors im ON im.monitor_id = m.id
       WHERE im.incident_id = $1
       ORDER BY m.name`,
      [incidentId]
    );
    return result.rows as AffectedMonitor[];
  }

  async getAffectedMonitorsBatch(
    incidentIds: string[]
  ): Promise<Record<string, AffectedMonitor[]>> {
    if (incidentIds.length === 0) return {};

    const result = await query(
      `SELECT im.incident_id, m.id, m.name, m.url, m.status, m.check_type
       FROM incident_monitors im
       INNER JOIN monitors m ON m.id = im.monitor_id
       WHERE im.incident_id = ANY($1::uuid[])
       ORDER BY m.name`,
      [incidentIds]
    );

    const map: Record<string, AffectedMonitor[]> = {};
    for (const row of result.rows) {
      const incidentId = row.incident_id as string;
      if (!map[incidentId]) map[incidentId] = [];
      map[incidentId].push({
        id: row.id,
        name: row.name,
        url: row.url,
        status: row.status,
        check_type: row.check_type,
      });
    }
    return map;
  }

  async addTimelineEvent(input: {
    incidentId: string;
    eventType: IncidentTimelineEventType;
    message: string;
    actorUserId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<IncidentTimelineEvent> {
    const result = await query(
      `INSERT INTO incident_timeline_events
         (incident_id, event_type, message, actor_user_id, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING *`,
      [
        input.incidentId,
        input.eventType,
        input.message,
        input.actorUserId ?? null,
        JSON.stringify(input.metadata ?? {}),
      ]
    );
    return mapTimeline(result.rows[0]);
  }

  async listTimeline(incidentId: string): Promise<IncidentTimelineEvent[]> {
    const result = await query(
      `SELECT * FROM incident_timeline_events
       WHERE incident_id = $1
       ORDER BY created_at ASC`,
      [incidentId]
    );
    return result.rows.map((row) => mapTimeline(row));
  }

  async addComment(input: {
    incidentId: string;
    userId: string;
    body: string;
  }): Promise<IncidentComment> {
    const result = await query(
      `INSERT INTO incident_comments (incident_id, user_id, body)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.incidentId, input.userId, input.body]
    );
    const row = result.rows[0];
    const emailResult = await query(`SELECT email FROM users WHERE id = $1`, [
      input.userId,
    ]);
    return mapComment({
      ...row,
      author_email: emailResult.rows[0]?.email ?? null,
    });
  }

  async listComments(incidentId: string): Promise<IncidentComment[]> {
    const result = await query(
      `SELECT c.*, u.email AS author_email
       FROM incident_comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.incident_id = $1
       ORDER BY c.created_at ASC`,
      [incidentId]
    );
    return result.rows.map((row) => mapComment(row));
  }
}
