-- Fase 7: Analytics — funções auxiliares de percentis (opcional, queries também inline)
-- Idempotente.

CREATE OR REPLACE FUNCTION analytics_latency_percentiles(
  p_user_id UUID,
  p_since TIMESTAMPTZ,
  p_monitor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  avg_ms    NUMERIC,
  p50_ms    NUMERIC,
  p95_ms    NUMERIC,
  p99_ms    NUMERIC,
  samples   BIGINT
)
LANGUAGE sql STABLE AS $$
  SELECT
    ROUND(AVG(pl.response_time_ms)::numeric, 1) AS avg_ms,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY pl.response_time_ms)::numeric, 1) AS p50_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY pl.response_time_ms)::numeric, 1) AS p95_ms,
    ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY pl.response_time_ms)::numeric, 1) AS p99_ms,
    COUNT(*)::bigint AS samples
  FROM ping_logs pl
  JOIN monitors m ON m.id = pl.monitor_id
  WHERE m.user_id = p_user_id
    AND pl.created_at >= p_since
    AND pl.is_up = TRUE
    AND pl.response_time_ms IS NOT NULL
    AND (p_monitor_id IS NULL OR pl.monitor_id = p_monitor_id);
$$;
