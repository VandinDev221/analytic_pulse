import type {
  AnalyticsAvailabilityPoint,
  AnalyticsLatencyPoint,
  AnalyticsMonitorRow,
  AnalyticsOverview,
  AnalyticsRange,
  AnalyticsSummary,
  LatencyPercentiles,
  MonitorStatus,
} from '@analytic-pulse/shared';
import { ValidationError } from '@analytic-pulse/shared';
import { query } from '../../../infrastructure/db';

const RANGE_DAYS: Record<AnalyticsRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

function parseRange(raw: string | undefined): AnalyticsRange {
  if (raw === '7d' || raw === '30d' || raw === '90d') return raw;
  if (!raw) return '30d';
  throw new ValidationError('range must be 7d, 30d or 90d');
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapPercentiles(row: Record<string, unknown> | undefined): LatencyPercentiles {
  if (!row) {
    return { avg_ms: null, p50_ms: null, p95_ms: null, p99_ms: null, samples: 0 };
  }
  return {
    avg_ms: num(row.avg_ms) != null ? Math.round(num(row.avg_ms)!) : null,
    p50_ms: num(row.p50_ms) != null ? Math.round(num(row.p50_ms)!) : null,
    p95_ms: num(row.p95_ms) != null ? Math.round(num(row.p95_ms)!) : null,
    p99_ms: num(row.p99_ms) != null ? Math.round(num(row.p99_ms)!) : null,
    samples: Number(row.samples ?? 0),
  };
}

export class AnalyticsService {
  async getOverview(userId: string, rangeRaw?: string): Promise<AnalyticsOverview> {
    const range = parseRange(rangeRaw);
    const days = RANGE_DAYS[range];
    const bucket = days <= 7 ? 'hour' : 'day';

    const [
      latencyResult,
      checksResult,
      availabilityResult,
      mttrResult,
      incidentsResult,
      mtbfResult,
      latencySeriesResult,
      availabilitySeriesResult,
      monitorsResult,
    ] = await Promise.all([
      query(
        `SELECT
           ROUND(AVG(pl.response_time_ms)::numeric, 1) AS avg_ms,
           ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY pl.response_time_ms)::numeric, 1) AS p50_ms,
           ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY pl.response_time_ms)::numeric, 1) AS p95_ms,
           ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY pl.response_time_ms)::numeric, 1) AS p99_ms,
           COUNT(*)::bigint AS samples
         FROM ping_logs pl
         JOIN monitors m ON m.id = pl.monitor_id
         WHERE m.user_id = $1
           AND pl.created_at >= NOW() - ($2 || ' days')::interval
           AND pl.is_up = TRUE
           AND pl.response_time_ms IS NOT NULL`,
        [userId, String(days)]
      ),
      query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE pl.is_up)::int AS up_count,
           COUNT(*) FILTER (WHERE NOT pl.is_up)::int AS down_count
         FROM ping_logs pl
         JOIN monitors m ON m.id = pl.monitor_id
         WHERE m.user_id = $1
           AND pl.created_at >= NOW() - ($2 || ' days')::interval`,
        [userId, String(days)]
      ),
      query(
        `SELECT
           CASE WHEN SUM(ud.total_pings) > 0
             THEN ROUND((SUM(ud.up_pings)::numeric / SUM(ud.total_pings) * 100), 3)
             ELSE NULL END AS availability_pct
         FROM uptime_daily ud
         JOIN monitors m ON m.id = ud.monitor_id
         WHERE m.user_id = $1
           AND ud.day >= CURRENT_DATE - ($2 || ' days')::interval`,
        [userId, String(days)]
      ),
      query(
        `SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(recovered_at, resolved_at) - opened_at)) * 1000)::float AS mttr
         FROM incidents
         WHERE user_id = $1
           AND status = 'resolved'
           AND COALESCE(recovered_at, resolved_at) IS NOT NULL
           AND opened_at >= NOW() - ($2 || ' days')::interval`,
        [userId, String(days)]
      ),
      query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status != 'resolved')::int AS open_count
         FROM incidents
         WHERE user_id = $1
           AND opened_at >= NOW() - ($2 || ' days')::interval`,
        [userId, String(days)]
      ),
      // MTBF: média do intervalo entre falhas consecutivas (opened_at)
      query(
        `WITH ordered AS (
           SELECT opened_at,
                  LAG(opened_at) OVER (ORDER BY opened_at) AS prev_opened
           FROM incidents
           WHERE user_id = $1
             AND opened_at >= NOW() - ($2 || ' days')::interval
         )
         SELECT AVG(EXTRACT(EPOCH FROM (opened_at - prev_opened)) * 1000)::float AS mtbf
         FROM ordered
         WHERE prev_opened IS NOT NULL`,
        [userId, String(days)]
      ),
      query(
        bucket === 'hour'
          ? `SELECT
               TO_CHAR(DATE_TRUNC('hour', pl.created_at), 'YYYY-MM-DD"T"HH24:00:00"Z"') AS bucket,
               ROUND(AVG(pl.response_time_ms)::numeric, 1) AS avg_ms,
               ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY pl.response_time_ms)::numeric, 1) AS p50_ms,
               ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY pl.response_time_ms)::numeric, 1) AS p95_ms,
               ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY pl.response_time_ms)::numeric, 1) AS p99_ms,
               COUNT(*)::int AS samples
             FROM ping_logs pl
             JOIN monitors m ON m.id = pl.monitor_id
             WHERE m.user_id = $1
               AND pl.created_at >= NOW() - ($2 || ' days')::interval
               AND pl.is_up = TRUE
               AND pl.response_time_ms IS NOT NULL
             GROUP BY 1
             ORDER BY 1 ASC`
          : `SELECT
               TO_CHAR(DATE_TRUNC('day', pl.created_at), 'YYYY-MM-DD') AS bucket,
               ROUND(AVG(pl.response_time_ms)::numeric, 1) AS avg_ms,
               ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY pl.response_time_ms)::numeric, 1) AS p50_ms,
               ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY pl.response_time_ms)::numeric, 1) AS p95_ms,
               ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY pl.response_time_ms)::numeric, 1) AS p99_ms,
               COUNT(*)::int AS samples
             FROM ping_logs pl
             JOIN monitors m ON m.id = pl.monitor_id
             WHERE m.user_id = $1
               AND pl.created_at >= NOW() - ($2 || ' days')::interval
               AND pl.is_up = TRUE
               AND pl.response_time_ms IS NOT NULL
             GROUP BY 1
             ORDER BY 1 ASC`,
        [userId, String(days)]
      ),
      query(
        `SELECT
           TO_CHAR(ud.day, 'YYYY-MM-DD') AS day,
           CASE WHEN SUM(ud.total_pings) > 0
             THEN ROUND((SUM(ud.up_pings)::numeric / SUM(ud.total_pings) * 100), 3)
             ELSE 0 END AS uptime_pct,
           SUM(ud.total_pings)::int AS total_pings,
           SUM(ud.up_pings)::int AS up_pings
         FROM uptime_daily ud
         JOIN monitors m ON m.id = ud.monitor_id
         WHERE m.user_id = $1
           AND ud.day >= CURRENT_DATE - ($2 || ' days')::interval
         GROUP BY ud.day
         ORDER BY ud.day ASC`,
        [userId, String(days)]
      ),
      query(
        `SELECT
           m.id AS monitor_id,
           m.name,
           m.status,
           (
             SELECT COUNT(*)::int FROM ping_logs pl2
             WHERE pl2.monitor_id = m.id
               AND pl2.created_at >= NOW() - ($2 || ' days')::interval
           ) AS checks_total,
           (
             SELECT COUNT(*)::int FROM ping_logs pl2
             WHERE pl2.monitor_id = m.id
               AND pl2.created_at >= NOW() - ($2 || ' days')::interval
               AND pl2.is_up = TRUE
           ) AS checks_up,
           ROUND(AVG(pl.response_time_ms)::numeric, 1) AS avg_ms,
           ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY pl.response_time_ms)::numeric, 1) AS p50_ms,
           ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY pl.response_time_ms)::numeric, 1) AS p95_ms,
           ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY pl.response_time_ms)::numeric, 1) AS p99_ms,
           COUNT(pl.*)::int AS samples,
           (
             SELECT COUNT(*)::int FROM incidents i
             JOIN incident_monitors im ON im.incident_id = i.id
             WHERE im.monitor_id = m.id
               AND i.opened_at >= NOW() - ($2 || ' days')::interval
           ) AS incidents
         FROM monitors m
         LEFT JOIN ping_logs pl
           ON pl.monitor_id = m.id
          AND pl.created_at >= NOW() - ($2 || ' days')::interval
          AND pl.is_up = TRUE
          AND pl.response_time_ms IS NOT NULL
         WHERE m.user_id = $1
           AND m.status != 'inactive'
         GROUP BY m.id, m.name, m.status
         ORDER BY m.name ASC`,
        [userId, String(days)]
      ),
    ]);

    const checks = checksResult.rows[0] as
      | { total: number; up_count: number; down_count: number }
      | undefined;
    const latency = mapPercentiles(latencyResult.rows[0] as Record<string, unknown>);
    const availabilityPct = num(availabilityResult.rows[0]?.availability_pct);
    // Fallback disponibilidade via ping_logs se uptime_daily vazio
    const availabilityFromChecks =
      checks && checks.total > 0
        ? Number(((checks.up_count / checks.total) * 100).toFixed(3))
        : null;

    const incidents = incidentsResult.rows[0] as
      | { total: number; open_count: number }
      | undefined;

    const summary: AnalyticsSummary = {
      range,
      availability_pct: availabilityPct ?? availabilityFromChecks,
      latency,
      mttr_ms:
        mttrResult.rows[0]?.mttr != null
          ? Math.round(Number(mttrResult.rows[0].mttr))
          : null,
      mtbf_ms:
        mtbfResult.rows[0]?.mtbf != null
          ? Math.round(Number(mtbfResult.rows[0].mtbf))
          : null,
      checks_total: Number(checks?.total ?? 0),
      checks_up: Number(checks?.up_count ?? 0),
      checks_down: Number(checks?.down_count ?? 0),
      incidents_total: Number(incidents?.total ?? 0),
      incidents_open: Number(incidents?.open_count ?? 0),
    };

    const latency_series: AnalyticsLatencyPoint[] = (
      latencySeriesResult.rows as Array<Record<string, unknown>>
    ).map((row) => ({
      bucket: String(row.bucket),
      avg_ms: num(row.avg_ms) != null ? Math.round(num(row.avg_ms)!) : null,
      p50_ms: num(row.p50_ms) != null ? Math.round(num(row.p50_ms)!) : null,
      p95_ms: num(row.p95_ms) != null ? Math.round(num(row.p95_ms)!) : null,
      p99_ms: num(row.p99_ms) != null ? Math.round(num(row.p99_ms)!) : null,
      samples: Number(row.samples ?? 0),
    }));

    const availability_series: AnalyticsAvailabilityPoint[] = (
      availabilitySeriesResult.rows as Array<Record<string, unknown>>
    ).map((row) => ({
      day: String(row.day),
      uptime_pct: Number(row.uptime_pct ?? 0),
      total_pings: Number(row.total_pings ?? 0),
      up_pings: Number(row.up_pings ?? 0),
    }));

    const monitors: AnalyticsMonitorRow[] = (
      monitorsResult.rows as Array<Record<string, unknown>>
    ).map((row) => {
      const checksTotal = Number(row.checks_total ?? 0);
      const checksUp = Number(row.checks_up ?? 0);
      return {
        monitor_id: String(row.monitor_id),
        name: String(row.name),
        status: row.status as MonitorStatus,
        availability_pct:
          checksTotal > 0
            ? Number(((checksUp / checksTotal) * 100).toFixed(3))
            : null,
        latency: mapPercentiles(row),
        checks_total: checksTotal,
        incidents: Number(row.incidents ?? 0),
      };
    });

    return {
      summary,
      latency_series,
      availability_series,
      monitors,
    };
  }
}
