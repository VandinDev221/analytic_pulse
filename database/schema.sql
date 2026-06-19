-- ============================================================
-- Analytic Pulse — PostgreSQL Schema
-- Render: analytic-pulse-db → PSQL / SQL Editor
-- Neon: SQL Editor
-- ============================================================


-- ── 0. Enable required extensions ─────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ── 1. Users (Local auth table) ────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255),                      -- NULL para contas só Google
  google_id       VARCHAR(255) UNIQUE,
  email_verified  BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  CONSTRAINT users_auth_method CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL)
);

-- Códigos de verificação no cadastro por e-mail
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  code          VARCHAR(6) NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_email_verification_email ON email_verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_email_verification_expires ON email_verification_codes(expires_at);


-- ── 2. Profiles (public user info + slug for status page) ────
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
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

DROP TRIGGER IF EXISTS on_auth_user_created ON users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();


-- ── 3. Monitors ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monitors (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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


-- ── 4. Ping Logs (historical check results) ───────────────────
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


-- ── 5. Notification Settings (Telegram ou WhatsApp) ───────────
CREATE TABLE IF NOT EXISTS notification_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  notification_channel  VARCHAR(20) DEFAULT 'telegram',
  -- Telegram
  telegram_bot_token    TEXT,
  telegram_chat_id      TEXT,
  -- WhatsApp (CallMeBot + número do TapDigits ou próprio)
  whatsapp_phone        TEXT,
  whatsapp_api_key      TEXT,
  is_enabled            BOOLEAN DEFAULT false,
  updated_at            TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);


-- ── 6. Uptime Daily View (pre-aggregated, 90-day grid) ────────
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


-- ── 7. RPC Function: get_monitor_metrics ─────────────────────
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
