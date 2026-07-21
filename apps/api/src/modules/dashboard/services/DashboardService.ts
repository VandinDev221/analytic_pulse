import type {
  DashboardHeatmapRow,
  DashboardOverview,
  DashboardSummary,
  DashboardTimelineItem,
  DashboardTopIncident,
  DashboardTopLatency,
  DashboardTrend,
  DashboardUsage,
  IncidentSeverity,
  IncidentStatus,
  MonitorStatus,
  UptimeDay,
} from '@analytic-pulse/shared';
import { query } from '../../../infrastructure/db';

function trendFrom(current: number | null, previous: number | null): DashboardTrend {
  if (current == null || previous == null || previous === 0) {
    return { pct: null, direction: 'unknown' };
  }
  const pct = Number((((current - previous) / previous) * 100).toFixed(1));
  if (Math.abs(pct) < 0.5) return { pct, direction: 'flat' };
  return { pct, direction: pct > 0 ? 'up' : 'down' };
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  return new Date(value).toISOString();
}

export class DashboardService {
  async getOverview(userId: string): Promise<DashboardOverview> {
    const [
      monitorsResult,
      profileResult,
      openIncidentsResult,
      mttrResult,
      checksResult,
      latencyResult,
      latencyPrevResult,
      uptimeResult,
      uptimePrevResult,
      gridResult,
      topIncidentsResult,
      timelineIncidentsResult,
      timelineEventsResult,
      maintenanceResult,
      alertDeliveriesResult,
      usageDailyResult,
      usageWeeklyResult,
      usageMonthlyResult,
    ] = await Promise.all([
      query(
        `SELECT id, name, status, last_response_time_ms, last_checked_at
         FROM monitors
         WHERE user_id = $1 AND status != 'inactive'
         ORDER BY created_at ASC`,
        [userId]
      ),
      query(
        `SELECT sla_target_pct FROM profiles WHERE user_id = $1`,
        [userId]
      ),
      query(
        `SELECT COUNT(*)::int AS n FROM incidents
         WHERE user_id = $1 AND status != 'resolved'`,
        [userId]
      ),
      query(
        `SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(recovered_at, resolved_at) - opened_at)) * 1000)::float AS mttr
         FROM incidents
         WHERE user_id = $1
           AND status = 'resolved'
           AND COALESCE(recovered_at, resolved_at) IS NOT NULL
           AND opened_at >= NOW() - INTERVAL '90 days'`,
        [userId]
      ),
      query(
        `SELECT
           COUNT(*) FILTER (WHERE pl.created_at >= NOW() - INTERVAL '24 hours')::int AS c24,
           COUNT(*) FILTER (WHERE pl.created_at >= NOW() - INTERVAL '7 days')::int AS c7,
           COUNT(*) FILTER (WHERE pl.created_at >= NOW() - INTERVAL '30 days')::int AS c30
         FROM ping_logs pl
         JOIN monitors m ON m.id = pl.monitor_id
         WHERE m.user_id = $1`,
        [userId]
      ),
      query(
        `SELECT m.id, m.name, m.status, AVG(pl.response_time_ms)::float AS avg_latency
         FROM monitors m
         JOIN ping_logs pl ON pl.monitor_id = m.id
         WHERE m.user_id = $1
           AND m.status != 'inactive'
           AND pl.created_at >= NOW() - INTERVAL '7 days'
           AND pl.is_up = true
           AND pl.response_time_ms IS NOT NULL
         GROUP BY m.id, m.name, m.status`,
        [userId]
      ),
      query(
        `SELECT AVG(pl.response_time_ms)::float AS avg_latency
         FROM ping_logs pl
         JOIN monitors m ON m.id = pl.monitor_id
         WHERE m.user_id = $1
           AND pl.created_at >= NOW() - INTERVAL '14 days'
           AND pl.created_at < NOW() - INTERVAL '7 days'
           AND pl.is_up = true
           AND pl.response_time_ms IS NOT NULL`,
        [userId]
      ),
      query(
        `SELECT monitor_id,
                CASE WHEN SUM(total_pings) > 0
                  THEN (SUM(up_pings)::float / SUM(total_pings) * 100)
                  ELSE NULL END AS uptime_pct
         FROM uptime_daily ud
         JOIN monitors m ON m.id = ud.monitor_id
         WHERE m.user_id = $1
           AND ud.day >= CURRENT_DATE - INTERVAL '7 days'
         GROUP BY monitor_id`,
        [userId]
      ),
      query(
        `SELECT CASE WHEN SUM(total_pings) > 0
                  THEN (SUM(up_pings)::float / SUM(total_pings) * 100)
                  ELSE NULL END AS uptime_pct
         FROM uptime_daily ud
         JOIN monitors m ON m.id = ud.monitor_id
         WHERE m.user_id = $1
           AND ud.day >= CURRENT_DATE - INTERVAL '14 days'
           AND ud.day < CURRENT_DATE - INTERVAL '7 days'`,
        [userId]
      ),
      query(
        `SELECT ud.monitor_id, TO_CHAR(ud.day, 'YYYY-MM-DD') AS day,
                ud.total_pings, ud.up_pings, ud.uptime_pct
         FROM uptime_daily ud
         JOIN monitors m ON m.id = ud.monitor_id
         WHERE m.user_id = $1
           AND m.status != 'inactive'
           AND ud.day >= CURRENT_DATE - INTERVAL '90 days'
         ORDER BY ud.day ASC`,
        [userId]
      ),
      query(
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
         ORDER BY
           CASE WHEN i.status = 'resolved' THEN 1 ELSE 0 END,
           i.opened_at DESC
         LIMIT 8`,
        [userId]
      ),
      query(
        `SELECT id, title, status, severity, opened_at, recovered_at, resolved_at
         FROM incidents
         WHERE user_id = $1
           AND opened_at >= NOW() - INTERVAL '14 days'
         ORDER BY opened_at DESC
         LIMIT 15`,
        [userId]
      ),
      query(
        `SELECT e.id, e.event_type, e.message, e.created_at, e.incident_id, i.title, i.severity
         FROM incident_timeline_events e
         JOIN incidents i ON i.id = e.incident_id
         WHERE i.user_id = $1
           AND e.created_at >= NOW() - INTERVAL '14 days'
         ORDER BY e.created_at DESC
         LIMIT 20`,
        [userId]
      ),
      query(
        `SELECT id, title, starts_at, ends_at, status
         FROM maintenance_windows
         WHERE user_id = $1
           AND starts_at >= NOW() - INTERVAL '14 days'
         ORDER BY starts_at DESC
         LIMIT 10`,
        [userId]
      ),
      query(
        `SELECT d.id, d.status, d.fired_at, d.created_at, d.payload, r.name AS rule_name
         FROM alert_deliveries d
         JOIN alert_rules r ON r.id = d.rule_id
         WHERE r.user_id = $1
           AND COALESCE(d.fired_at, d.created_at) >= NOW() - INTERVAL '14 days'
         ORDER BY COALESCE(d.fired_at, d.created_at) DESC
         LIMIT 10`,
        [userId]
      ),
      query(
        `SELECT TO_CHAR(day, 'YYYY-MM-DD') AS label, checks::int AS checks
         FROM (
           SELECT DATE_TRUNC('day', pl.created_at) AS day, COUNT(*) AS checks
           FROM ping_logs pl
           JOIN monitors m ON m.id = pl.monitor_id
           WHERE m.user_id = $1
             AND pl.created_at >= NOW() - INTERVAL '14 days'
           GROUP BY 1
           ORDER BY 1 ASC
         ) t`,
        [userId]
      ),
      query(
        `SELECT TO_CHAR(week, 'IYYY-"W"IW') AS label, checks::int AS checks
         FROM (
           SELECT DATE_TRUNC('week', pl.created_at) AS week, COUNT(*) AS checks
           FROM ping_logs pl
           JOIN monitors m ON m.id = pl.monitor_id
           WHERE m.user_id = $1
             AND pl.created_at >= NOW() - INTERVAL '12 weeks'
           GROUP BY 1
           ORDER BY 1 ASC
         ) t`,
        [userId]
      ),
      query(
        `SELECT TO_CHAR(month, 'YYYY-MM') AS label, checks::int AS checks
         FROM (
           SELECT DATE_TRUNC('month', pl.created_at) AS month, COUNT(*) AS checks
           FROM ping_logs pl
           JOIN monitors m ON m.id = pl.monitor_id
           WHERE m.user_id = $1
             AND pl.created_at >= NOW() - INTERVAL '6 months'
           GROUP BY 1
           ORDER BY 1 ASC
         ) t`,
        [userId]
      ),
    ]);

    const monitors = monitorsResult.rows as Array<{
      id: string;
      name: string;
      status: MonitorStatus;
      last_response_time_ms: number | null;
      last_checked_at: Date | string | null;
    }>;

    const slaTarget = Number(profileResult.rows[0]?.sla_target_pct ?? 99.9);
    const latencyByMonitor = new Map(
      (latencyResult.rows as Array<{ id: string; name: string; status: MonitorStatus; avg_latency: number }>).map(
        (r) => [r.id, Math.round(Number(r.avg_latency))]
      )
    );

    const gridsByMonitor = new Map<string, UptimeDay[]>();
    for (const row of gridResult.rows as Array<{
      monitor_id: string;
      day: string;
      total_pings: number;
      up_pings: number;
      uptime_pct: number;
    }>) {
      const list = gridsByMonitor.get(row.monitor_id) ?? [];
      list.push({
        day: row.day,
        uptime_pct: Number(row.uptime_pct),
        total_pings: Number(row.total_pings),
      });
      gridsByMonitor.set(row.monitor_id, list);
    }

    const uptime90ByMonitor = new Map<string, number | null>();
    for (const m of monitors) {
      const days = gridsByMonitor.get(m.id) ?? [];
      const total = days.reduce((s, d) => s + d.total_pings, 0);
      const up = days.reduce(
        (s, d) => s + Math.round((d.total_pings * d.uptime_pct) / 100),
        0
      );
      uptime90ByMonitor.set(m.id, total > 0 ? Number(((up / total) * 100).toFixed(2)) : null);
    }

    const uptimes90 = [...uptime90ByMonitor.values()].filter((v): v is number => v != null);
    const overallUptime90 =
      uptimes90.length > 0
        ? Number((uptimes90.reduce((a, b) => a + b, 0) / uptimes90.length).toFixed(2))
        : null;

    const uptime7Rows = uptimeResult.rows as Array<{ monitor_id: string; uptime_pct: number | null }>;
    const uptime7Values = uptime7Rows
      .map((r) => (r.uptime_pct != null ? Number(r.uptime_pct) : null))
      .filter((v): v is number => v != null);
    const overallUptime7 =
      uptime7Values.length > 0
        ? Number((uptime7Values.reduce((a, b) => a + b, 0) / uptime7Values.length).toFixed(2))
        : null;
    const uptimePrev7 =
      uptimePrevResult.rows[0]?.uptime_pct != null
        ? Number(Number(uptimePrevResult.rows[0].uptime_pct).toFixed(2))
        : null;

    const latencies = [...latencyByMonitor.values()];
    const avgLatency7 =
      latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null;
    const avgLatencyPrev =
      latencyPrevResult.rows[0]?.avg_latency != null
        ? Math.round(Number(latencyPrevResult.rows[0].avg_latency))
        : null;

    const checks = checksResult.rows[0] as
      | { c24: number; c7: number; c30: number }
      | undefined;

    const summary: DashboardSummary = {
      monitors_total: monitors.length,
      monitors_up: monitors.filter((m) => m.status === 'up').length,
      monitors_down: monitors.filter((m) => m.status === 'down').length,
      monitors_unknown: monitors.filter(
        (m) => m.status !== 'up' && m.status !== 'down'
      ).length,
      overall_uptime_90d: overallUptime90,
      overall_uptime_7d: overallUptime7,
      avg_latency_7d: avgLatency7,
      avg_latency_prev_7d: avgLatencyPrev,
      latency_trend: trendFrom(avgLatency7, avgLatencyPrev),
      uptime_trend: trendFrom(overallUptime7, uptimePrev7),
      sla_target_pct: slaTarget,
      sla_met: overallUptime90 != null ? overallUptime90 >= slaTarget : null,
      open_incidents: Number(openIncidentsResult.rows[0]?.n ?? 0),
      mttr_ms:
        mttrResult.rows[0]?.mttr != null
          ? Math.round(Number(mttrResult.rows[0].mttr))
          : null,
      checks_24h: Number(checks?.c24 ?? 0),
      checks_7d: Number(checks?.c7 ?? 0),
      checks_30d: Number(checks?.c30 ?? 0),
    };

    const top_latencies: DashboardTopLatency[] = [...latencyByMonitor.entries()]
      .map(([monitor_id, avg_latency_7d]) => {
        const mon = monitors.find((m) => m.id === monitor_id);
        return {
          monitor_id,
          name: mon?.name ?? 'Monitor',
          status: (mon?.status ?? 'unknown') as MonitorStatus,
          avg_latency_7d,
          uptime_90d: uptime90ByMonitor.get(monitor_id) ?? null,
        };
      })
      .sort((a, b) => b.avg_latency_7d - a.avg_latency_7d)
      .slice(0, 5);

    const top_incidents: DashboardTopIncident[] = (
      topIncidentsResult.rows as Array<{
        id: string;
        title: string;
        status: IncidentStatus;
        severity: IncidentSeverity;
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
        duration_ms: Math.max(0, end - opened),
        affected_monitor_names: row.affected_monitor_names ?? [],
      };
    });

    const heatmap: DashboardHeatmapRow[] = monitors.map((m) => ({
      monitor_id: m.id,
      name: m.name,
      status: m.status,
      uptime_90d: uptime90ByMonitor.get(m.id) ?? null,
      days: gridsByMonitor.get(m.id) ?? [],
    }));

    const timeline: DashboardTimelineItem[] = [];

    for (const row of timelineEventsResult.rows as Array<{
      id: string;
      event_type: string;
      message: string | null;
      created_at: Date | string;
      incident_id: string;
      title: string;
      severity: IncidentSeverity;
    }>) {
      let kind: DashboardTimelineItem['kind'] = 'incident_opened';
      if (row.event_type === 'incident_resolved' || row.event_type === 'monitor_up') {
        kind = row.event_type === 'monitor_up' ? 'monitor_up' : 'incident_resolved';
      } else if (row.event_type === 'incident_acknowledged') {
        kind = 'incident_acknowledged';
      } else if (row.event_type === 'alert_sent') {
        kind = 'alert';
      } else if (row.event_type === 'monitor_down') {
        kind = 'monitor_down';
      } else if (row.event_type === 'incident_opened') {
        kind = 'incident_opened';
      }
      timeline.push({
        id: `evt-${row.id}`,
        kind,
        title: row.title,
        subtitle: row.message,
        at: toIso(row.created_at)!,
        href: `/incidents/${row.incident_id}`,
        severity: row.severity,
      });
    }

    for (const row of timelineIncidentsResult.rows as Array<{
      id: string;
      title: string;
      status: IncidentStatus;
      severity: IncidentSeverity;
      opened_at: Date | string;
      resolved_at: Date | string | null;
    }>) {
      timeline.push({
        id: `inc-open-${row.id}`,
        kind: 'incident_opened',
        title: row.title,
        subtitle: `Severidade ${row.severity}`,
        at: toIso(row.opened_at)!,
        href: `/incidents/${row.id}`,
        severity: row.severity,
      });
      if (row.resolved_at) {
        timeline.push({
          id: `inc-res-${row.id}`,
          kind: 'incident_resolved',
          title: row.title,
          subtitle: 'Resolvido',
          at: toIso(row.resolved_at)!,
          href: `/incidents/${row.id}`,
          severity: row.severity,
        });
      }
    }

    for (const row of maintenanceResult.rows as Array<{
      id: string;
      title: string;
      starts_at: Date | string;
      status: string;
    }>) {
      timeline.push({
        id: `maint-${row.id}`,
        kind: 'maintenance',
        title: row.title,
        subtitle: `Manutenção (${row.status})`,
        at: toIso(row.starts_at)!,
        href: '/status-page',
        severity: null,
      });
    }

    for (const row of alertDeliveriesResult.rows as Array<{
      id: string;
      status: string;
      fired_at: Date | string | null;
      created_at: Date | string;
      rule_name: string;
    }>) {
      timeline.push({
        id: `alert-${row.id}`,
        kind: 'alert',
        title: row.rule_name,
        subtitle: `Alerta ${row.status}`,
        at: toIso(row.fired_at ?? row.created_at)!,
        href: '/alerts',
        severity: null,
      });
    }

    timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const deduped: DashboardTimelineItem[] = [];
    const seen = new Set<string>();
    for (const item of timeline) {
      const key = `${item.kind}:${item.title}:${item.at.slice(0, 16)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
      if (deduped.length >= 20) break;
    }

    const usage: DashboardUsage = {
      daily: (usageDailyResult.rows as Array<{ label: string; checks: number }>).map((r) => ({
        label: r.label,
        checks: Number(r.checks),
      })),
      weekly: (usageWeeklyResult.rows as Array<{ label: string; checks: number }>).map((r) => ({
        label: r.label,
        checks: Number(r.checks),
      })),
      monthly: (usageMonthlyResult.rows as Array<{ label: string; checks: number }>).map((r) => ({
        label: r.label,
        checks: Number(r.checks),
      })),
    };

    return {
      summary,
      top_latencies,
      top_incidents,
      heatmap,
      timeline: deduped,
      usage,
    };
  }
}
