-- ============================================================
-- PingPulse — Supabase PostgreSQL Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================


-- ── 0. Enable required extension ─────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ── 1. Profiles (public user info + slug for status page) ────
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  slug            VARCHAR(60) UNIQUE NOT NULL,       -- e.g. "mycompany" → /status/mycompany
  display_name    VARCHAR(100),
  page_title      VARCHAR(150),
  page_description TEXT,
  created_at      TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Auto-create a profile with a random slug on new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (user_id, slug, display_name)
  VALUES (
    NEW.id,
    LOWER(REPLACE(gen_random_uuid()::text, '-', '')),
    SPLIT_PART(NEW.email, '@', 1)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ── 2. Monitors ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monitors (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                    VARCHAR(100) NOT NULL,
  url                     VARCHAR(500) NOT NULL,
  method                  VARCHAR(10)  DEFAULT 'GET',
  interval_minutes        INTEGER      DEFAULT 5,
  status                  VARCHAR(20)  DEFAULT 'active',
  -- 'active' | 'inactive' | 'up' | 'down'
  last_checked_at         TIMESTAMPTZ,
  last_response_time_ms   INTEGER,
  created_at              TIMESTAMPTZ  DEFAULT TIMEZONE('utc', NOW())
);

-- Index for fast per-user monitor listing
CREATE INDEX IF NOT EXISTS idx_monitors_user_id ON monitors(user_id);
-- Index for cron job query (fetch only active monitors)
CREATE INDEX IF NOT EXISTS idx_monitors_status  ON monitors(status);


-- ── 3. Ping Logs (historical check results) ───────────────────
CREATE TABLE IF NOT EXISTS ping_logs (
  id                BIGSERIAL PRIMARY KEY,
  monitor_id        UUID    NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  status_code       INTEGER,                -- HTTP response code (null on network error)
  response_time_ms  INTEGER NOT NULL,
  is_up             BOOLEAN NOT NULL,
  error_message     TEXT,
  created_at        TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Critical indexes for fast aggregation queries
CREATE INDEX IF NOT EXISTS idx_ping_logs_monitor_id   ON ping_logs(monitor_id);
CREATE INDEX IF NOT EXISTS idx_ping_logs_created_at   ON ping_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ping_logs_monitor_date ON ping_logs(monitor_id, created_at DESC);


-- ── 4. Notification Settings (per user, Telegram) ────────────
CREATE TABLE IF NOT EXISTS notification_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  telegram_bot_token  TEXT,
  telegram_chat_id    TEXT,
  is_enabled          BOOLEAN DEFAULT false,
  updated_at          TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);


-- ── 5. Uptime Daily View (pre-aggregated, 90-day grid) ────────
-- This view avoids heavy loop processing on the backend.
-- Aggregates ping_logs by (monitor_id, day) efficiently.
CREATE OR REPLACE VIEW uptime_daily AS
SELECT
  monitor_id,
  DATE(created_at AT TIME ZONE 'UTC')          AS day,
  COUNT(*)                                      AS total_pings,
  COUNT(*) FILTER (WHERE is_up = TRUE)          AS up_pings,
  ROUND(
    (COUNT(*) FILTER (WHERE is_up = TRUE))::NUMERIC
    / NULLIF(COUNT(*), 0) * 100,
    2
  )                                              AS uptime_pct
FROM ping_logs
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY monitor_id, DATE(created_at AT TIME ZONE 'UTC')
ORDER BY day ASC;


-- ── 6. RPC Function: get_monitor_metrics ─────────────────────
-- Returns 7-day uptime % and average latency for a single monitor.
-- Called by: GET /api/monitors/:id/metrics
CREATE OR REPLACE FUNCTION get_monitor_metrics(p_monitor_id UUID)
RETURNS TABLE (
  avg_response_time_7d  NUMERIC,
  uptime_pct_7d         NUMERIC,
  total_checks_7d       BIGINT
)
LANGUAGE sql STABLE AS $$
  SELECT
    ROUND(AVG(response_time_ms) FILTER (WHERE is_up = TRUE), 2) AS avg_response_time_7d,
    ROUND(
      COUNT(*) FILTER (WHERE is_up = TRUE)::NUMERIC
      / NULLIF(COUNT(*), 0) * 100,
      2
    )                                                            AS uptime_pct_7d,
    COUNT(*)                                                     AS total_checks_7d
  FROM ping_logs
  WHERE
    monitor_id = p_monitor_id
    AND created_at >= NOW() - INTERVAL '7 days';
$$;


-- ── 7. Row Level Security (RLS) ───────────────────────────────
-- Users can only read/write their own data.

ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitors              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ping_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_own" ON profiles
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow anyone to read profiles (needed for public status pages)
CREATE POLICY "profiles_public_read" ON profiles
  FOR SELECT USING (true);

-- Monitors
CREATE POLICY "monitors_own" ON monitors
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ping logs — users can only see their own (via monitor_id)
CREATE POLICY "ping_logs_own" ON ping_logs
  USING (
    monitor_id IN (SELECT id FROM monitors WHERE user_id = auth.uid())
  );

-- Notification settings
CREATE POLICY "notification_settings_own" ON notification_settings
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ── 8. Optional: Auto-prune old ping logs (> 90 days) ────────
-- Run this periodically via Supabase Scheduled Functions or a cron job.
-- DELETE FROM ping_logs WHERE created_at < NOW() - INTERVAL '90 days';
