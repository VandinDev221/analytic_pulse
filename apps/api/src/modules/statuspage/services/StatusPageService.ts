import crypto from 'crypto';
import type {
  CreateMaintenanceInput,
  MaintenanceWindow,
  StatusPageData,
  StatusPageIncidentSummary,
  StatusPageStats,
  UpdateStatusPageSettingsInput,
} from '@analytic-pulse/shared';
import { NotFoundError, ValidationError } from '@analytic-pulse/shared';
import { query } from '../../../infrastructure/db';
import { logger } from '../../../observability/logger';

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  return new Date(value).toISOString();
}

function mapMaintenance(row: Record<string, unknown>): MaintenanceWindow {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    starts_at: toIso(row.starts_at as Date | string)!,
    ends_at: toIso(row.ends_at as Date | string)!,
    status: row.status as MaintenanceWindow['status'],
    created_at: toIso(row.created_at as Date | string)!,
    updated_at: toIso(row.updated_at as Date | string)!,
  };
}

export class StatusPageService {
  async getPublicPage(slug: string): Promise<StatusPageData> {
    const profileResult = await query(
      `SELECT user_id, slug, display_name, page_title, page_description,
              theme, accent_color, logo_url, custom_domain, sla_target_pct,
              show_uptime_history, show_incidents, show_maintenance
       FROM profiles
       WHERE slug = $1 OR custom_domain = $1`,
      [slug]
    );

    if (profileResult.rows.length === 0) {
      throw new NotFoundError('Status page');
    }

    const profile = profileResult.rows[0];
    const userId = profile.user_id as string;
    const slaTarget = Number(profile.sla_target_pct ?? 99.9);

    const monitorsResult = await query(
      `SELECT id, name, url, status, last_checked_at, last_response_time_ms, check_type
       FROM monitors
       WHERE user_id = $1 AND status != 'inactive'
       ORDER BY created_at ASC`,
      [userId]
    );
    const monitors = monitorsResult.rows as Array<{
      id: string;
      name: string;
      url: string;
      status: string;
      last_checked_at: Date | string | null;
      last_response_time_ms: number | null;
      check_type: string;
    }>;

    const uptimeGrids: StatusPageData['uptime_grids'] = {};
    let monitorsWithStats = monitors.map((m) => ({
      ...m,
      uptime_90d: null as string | null,
      avg_latency_7d: null as number | null,
    }));

    if (monitors.length > 0) {
      const monitorIds = monitors.map((m) => m.id);

      const gridResult = await query(
        `SELECT monitor_id, TO_CHAR(day, 'YYYY-MM-DD') as day, total_pings, up_pings, uptime_pct
         FROM uptime_daily
         WHERE monitor_id = ANY($1)
           AND day >= CURRENT_DATE - INTERVAL '90 days'
         ORDER BY day ASC`,
        [monitorIds]
      );

      for (const row of gridResult.rows as Array<{
        monitor_id: string;
        day: string;
        total_pings: number;
        up_pings: number;
        uptime_pct: number;
      }>) {
        if (!uptimeGrids[row.monitor_id]) uptimeGrids[row.monitor_id] = [];
        uptimeGrids[row.monitor_id].push({
          day: row.day,
          uptime_pct: Number(row.uptime_pct),
          total_pings: Number(row.total_pings),
        });
      }

      const latencyResult = await query(
        `SELECT monitor_id, AVG(response_time_ms)::float AS avg_latency
         FROM ping_logs
         WHERE monitor_id = ANY($1)
           AND created_at >= NOW() - INTERVAL '7 days'
         GROUP BY monitor_id`,
        [monitorIds]
      );
      const latencyMap: Record<string, number> = {};
      for (const row of latencyResult.rows as Array<{
        monitor_id: string;
        avg_latency: number;
      }>) {
        latencyMap[row.monitor_id] = Math.round(Number(row.avg_latency));
      }

      monitorsWithStats = monitors.map((monitor) => {
        const days = uptimeGrids[monitor.id] ?? [];
        const totalPings = days.reduce((s, d) => s + d.total_pings, 0);
        const upPings = days.reduce(
          (s, d) => s + Math.round((d.total_pings * d.uptime_pct) / 100),
          0
        );
        const overallUptime =
          totalPings > 0 ? ((upPings / totalPings) * 100).toFixed(2) : null;

        return {
          ...monitor,
          uptime_90d: overallUptime,
          avg_latency_7d: latencyMap[monitor.id] ?? null,
        };
      });
    }

    let incidents: StatusPageIncidentSummary[] = [];
    if (profile.show_incidents !== false) {
      const incidentsResult = await query(
        `SELECT i.id, i.title, i.status, i.severity, i.opened_at, i.recovered_at, i.resolved_at,
                COALESCE(
                  ARRAY_AGG(DISTINCT m.name) FILTER (WHERE m.name IS NOT NULL),
                  '{}'
                ) AS affected_monitor_names
         FROM incidents i
         LEFT JOIN incident_monitors im ON im.incident_id = i.id
         LEFT JOIN monitors m ON m.id = im.monitor_id
         WHERE i.user_id = $1
           AND i.opened_at >= NOW() - INTERVAL '90 days'
         GROUP BY i.id
         ORDER BY i.opened_at DESC
         LIMIT 20`,
        [userId]
      );

      incidents = (
        incidentsResult.rows as Array<{
          id: string;
          title: string;
          status: StatusPageIncidentSummary['status'];
          severity: StatusPageIncidentSummary['severity'];
          opened_at: Date | string;
          recovered_at: Date | string | null;
          resolved_at: Date | string | null;
          affected_monitor_names: string[] | null;
        }>
      ).map((row) => {
        const opened = new Date(row.opened_at).getTime();
        const end = row.recovered_at
          ? new Date(row.recovered_at).getTime()
          : row.resolved_at
            ? new Date(row.resolved_at).getTime()
            : Date.now();
        return {
          id: row.id,
          title: row.title,
          status: row.status,
          severity: row.severity,
          opened_at: toIso(row.opened_at)!,
          recovered_at: toIso(row.recovered_at),
          resolved_at: toIso(row.resolved_at),
          duration_ms: Math.max(0, end - opened),
          affected_monitor_names: row.affected_monitor_names ?? [],
        };
      });
    }

    let maintenance: MaintenanceWindow[] = [];
    if (profile.show_maintenance !== false) {
      const maintResult = await query(
        `SELECT * FROM maintenance_windows
         WHERE user_id = $1
           AND status IN ('scheduled', 'active')
           AND ends_at >= NOW() - INTERVAL '7 days'
         ORDER BY starts_at ASC
         LIMIT 20`,
        [userId]
      );
      maintenance = (maintResult.rows as Record<string, unknown>[]).map((row) =>
        mapMaintenance(row)
      );
    }

    const uptimes = monitorsWithStats
      .map((m) => (m.uptime_90d != null ? Number(m.uptime_90d) : null))
      .filter((v): v is number => v != null);
    const overallUptime =
      uptimes.length > 0
        ? Number((uptimes.reduce((a, b) => a + b, 0) / uptimes.length).toFixed(2))
        : null;

    const latencies = monitorsWithStats
      .map((m) => m.avg_latency_7d)
      .filter((v): v is number => v != null);
    const avgLatency =
      latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null;

    const mttrResult = await query(
      `SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(recovered_at, resolved_at) - opened_at)) * 1000)::float AS mttr
       FROM incidents
       WHERE user_id = $1
         AND status = 'resolved'
         AND COALESCE(recovered_at, resolved_at) IS NOT NULL
         AND opened_at >= NOW() - INTERVAL '90 days'`,
      [userId]
    );
    const mttr =
      mttrResult.rows[0]?.mttr != null
        ? Math.round(Number(mttrResult.rows[0].mttr))
        : null;

    const openIncidents = incidents.filter((i) => i.status !== 'resolved').length;

    const stats: StatusPageStats = {
      overall_uptime_90d: overallUptime,
      avg_latency_7d: avgLatency,
      sla_target_pct: slaTarget,
      sla_met: overallUptime != null ? overallUptime >= slaTarget : null,
      open_incidents: openIncidents,
      mttr_ms: mttr,
    };

    return {
      profile: {
        display_name: profile.display_name,
        page_title: profile.page_title,
        page_description: profile.page_description,
        slug: profile.slug,
        theme: profile.theme || 'system',
        accent_color: profile.accent_color,
        logo_url: profile.logo_url,
        custom_domain: profile.custom_domain,
        sla_target_pct: slaTarget,
        show_uptime_history: profile.show_uptime_history !== false,
        show_incidents: profile.show_incidents !== false,
        show_maintenance: profile.show_maintenance !== false,
      },
      monitors: monitorsWithStats as StatusPageData['monitors'],
      uptime_grids: profile.show_uptime_history === false ? {} : uptimeGrids,
      incidents,
      maintenance,
      stats,
    };
  }

  async getSettings(userId: string) {
    const result = await query(
      `SELECT slug, display_name, page_title, page_description,
              theme, accent_color, logo_url, custom_domain, sla_target_pct,
              show_uptime_history, show_incidents, show_maintenance, webhook_url
       FROM profiles WHERE user_id = $1`,
      [userId]
    );
    if (!result.rows[0]) throw new NotFoundError('Profile');
    return result.rows[0];
  }

  async updateSettings(userId: string, input: UpdateStatusPageSettingsInput) {
    if (input.slug) {
      const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      if (slug.length < 3) throw new ValidationError('Slug must be at least 3 characters');
      const clash = await query(
        `SELECT id FROM profiles WHERE slug = $1 AND user_id != $2`,
        [slug, userId]
      );
      if (clash.rows.length > 0) throw new ValidationError('Slug already taken');
      input.slug = slug;
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    const map: Array<[keyof UpdateStatusPageSettingsInput, unknown]> = [
      ['display_name', input.display_name],
      ['page_title', input.page_title],
      ['page_description', input.page_description],
      ['slug', input.slug],
      ['theme', input.theme],
      ['accent_color', input.accent_color],
      ['logo_url', input.logo_url],
      ['custom_domain', input.custom_domain],
      ['sla_target_pct', input.sla_target_pct],
      ['show_uptime_history', input.show_uptime_history],
      ['show_incidents', input.show_incidents],
      ['show_maintenance', input.show_maintenance],
      ['webhook_url', input.webhook_url],
    ];

    for (const [key, value] of map) {
      if (value !== undefined) {
        fields.push(`${key} = $${i++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) throw new ValidationError('No fields to update');

    values.push(userId);
    const result = await query(
      `UPDATE profiles SET ${fields.join(', ')}
       WHERE user_id = $${i}
       RETURNING slug, display_name, page_title, page_description,
                 theme, accent_color, logo_url, custom_domain, sla_target_pct,
                 show_uptime_history, show_incidents, show_maintenance, webhook_url`,
      values
    );
    return result.rows[0];
  }

  async listMaintenance(userId: string): Promise<MaintenanceWindow[]> {
    const result = await query(
      `SELECT * FROM maintenance_windows
       WHERE user_id = $1
       ORDER BY starts_at DESC
       LIMIT 50`,
      [userId]
    );
    return (result.rows as Record<string, unknown>[]).map((row) => mapMaintenance(row));
  }

  async createMaintenance(
    userId: string,
    input: CreateMaintenanceInput
  ): Promise<MaintenanceWindow> {
    if (!input.title?.trim()) throw new ValidationError('title is required');
    const starts = new Date(input.starts_at);
    const ends = new Date(input.ends_at);
    if (!(ends > starts)) throw new ValidationError('ends_at must be after starts_at');

    const result = await query(
      `INSERT INTO maintenance_windows (user_id, title, description, starts_at, ends_at, status)
       VALUES ($1, $2, $3, $4, $5, 'scheduled')
       RETURNING *`,
      [
        userId,
        input.title.trim(),
        input.description ?? null,
        starts.toISOString(),
        ends.toISOString(),
      ]
    );
    return mapMaintenance(result.rows[0]);
  }

  async deleteMaintenance(id: string, userId: string): Promise<void> {
    const result = await query(
      `DELETE FROM maintenance_windows WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if ((result.rowCount ?? 0) === 0) throw new NotFoundError('Maintenance window');
  }

  async subscribe(slug: string, email: string): Promise<{ message: string }> {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new ValidationError('Invalid email');
    }

    const profileResult = await query(
      `SELECT user_id FROM profiles WHERE slug = $1`,
      [slug]
    );
    if (!profileResult.rows[0]) throw new NotFoundError('Status page');

    const token = crypto.randomBytes(24).toString('hex');
    await query(
      `INSERT INTO status_subscribers (user_id, email, is_verified, verify_token)
       VALUES ($1, $2, false, $3)
       ON CONFLICT (user_id, email) DO UPDATE SET verify_token = EXCLUDED.verify_token`,
      [profileResult.rows[0].user_id, normalized, token]
    );

    logger.info('Status page subscription created', {
      slug,
      email: normalized,
    });

    // Verificação por e-mail pode usar Resend futuramente; por enquanto confirma inscrição.
    await query(
      `UPDATE status_subscribers SET is_verified = true
       WHERE user_id = $1 AND email = $2`,
      [profileResult.rows[0].user_id, normalized]
    );

    return { message: 'Inscrição realizada com sucesso' };
  }

  async buildRss(slug: string): Promise<string> {
    const page = await this.getPublicPage(slug);
    const title = page.profile.page_title || `${page.profile.display_name} Status`;
    const items = (page.incidents ?? [])
      .slice(0, 20)
      .map((inc) => {
        const desc = `${inc.status} · ${inc.severity} · ${inc.affected_monitor_names.join(', ')}`;
        return `
    <item>
      <title><![CDATA[${inc.title}]]></title>
      <description><![CDATA[${desc}]]></description>
      <pubDate>${new Date(inc.opened_at).toUTCString()}</pubDate>
      <guid isPermaLink="false">${inc.id}</guid>
    </item>`;
      })
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title><![CDATA[${title}]]></title>
    <description><![CDATA[${page.profile.page_description || 'Status updates'}]]></description>
    <link>/status/${slug}</link>
    ${items}
  </channel>
</rss>`;
  }

  async notifyWebhookIfConfigured(
    userId: string,
    event: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const result = await query(
      `SELECT webhook_url FROM profiles WHERE user_id = $1`,
      [userId]
    );
    const url = result.rows[0]?.webhook_url as string | undefined;
    if (!url) return;

    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          source: 'analytic-pulse',
          timestamp: new Date().toISOString(),
          ...payload,
        }),
      });
    } catch (error) {
      logger.warn('Status page webhook failed', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
