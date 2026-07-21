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
  check_type              VARCHAR(20)  NOT NULL DEFAULT 'http',
  -- 'http' | 'https' | 'tcp' | 'port' | 'ping' | 'dns' | 'ssl'
  host                    VARCHAR(255),
  port                    INTEGER,
  dns_record_type         VARCHAR(10)  DEFAULT 'A',
  keyword                 TEXT,
  expected_status_codes   JSONB        DEFAULT '[200,201,202,204,301,302,304]'::jsonb,
  expected_header_name    VARCHAR(120),
  expected_header_value   TEXT,
  json_path               TEXT,
  json_expected           TEXT,
  request_headers         JSONB        DEFAULT '{}'::jsonb,
  request_body            TEXT,
  last_checked_at         TIMESTAMPTZ,
  last_response_time_ms   INTEGER,
  created_at              TIMESTAMPTZ  DEFAULT TIMEZONE('utc', NOW())
);

-- Index for fast per-user monitor listing
CREATE INDEX IF NOT EXISTS idx_monitors_user_id ON monitors(user_id);
-- Index for cron job query (fetch only active monitors)
CREATE INDEX IF NOT EXISTS idx_monitors_status  ON monitors(status);
CREATE INDEX IF NOT EXISTS idx_monitors_check_type ON monitors(check_type);


-- ── 4. Ping Logs (historical check results) ───────────────────
CREATE TABLE IF NOT EXISTS ping_logs (
  id                  BIGSERIAL PRIMARY KEY,
  monitor_id          UUID    NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  status_code         INTEGER,
  response_time_ms    INTEGER NOT NULL,
  is_up               BOOLEAN NOT NULL,
  error_message       TEXT,
  check_type          VARCHAR(20),
  dns_ms              INTEGER,
  tcp_ms              INTEGER,
  tls_ms              INTEGER,
  ttfb_ms             INTEGER,
  download_ms         INTEGER,
  response_size_bytes INTEGER,
  content_length      INTEGER,
  response_headers    JSONB,
  redirect_chain      JSONB,
  created_at          TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
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

-- -- 7. Incidents (Fase 2) -------------------------------------
CREATE TABLE IF NOT EXISTS incidents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             VARCHAR(200) NOT NULL,
  status            VARCHAR(30)  NOT NULL DEFAULT 'open',
  severity          VARCHAR(20)  NOT NULL DEFAULT 'major',
  root_cause        TEXT,
  notes             TEXT,
  tags              TEXT[]       DEFAULT '{}',
  opened_at         TIMESTAMPTZ  NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  acknowledged_at   TIMESTAMPTZ,
  recovered_at      TIMESTAMPTZ,
  resolved_at       TIMESTAMPTZ,
  acknowledged_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ  DEFAULT TIMEZONE('utc', NOW()),
  updated_at        TIMESTAMPTZ  DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_incidents_user_id ON incidents(user_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_opened_at ON incidents(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_user_status ON incidents(user_id, status);

CREATE TABLE IF NOT EXISTS incident_monitors (
  incident_id  UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  monitor_id   UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  PRIMARY KEY (incident_id, monitor_id)
);

CREATE INDEX IF NOT EXISTS idx_incident_monitors_monitor ON incident_monitors(monitor_id);

CREATE TABLE IF NOT EXISTS incident_timeline_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id   UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  event_type    VARCHAR(50) NOT NULL,
  message       TEXT NOT NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_incident_timeline_incident
  ON incident_timeline_events(incident_id, created_at ASC);

CREATE TABLE IF NOT EXISTS incident_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id   UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body          TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at    TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_incident_comments_incident
  ON incident_comments(incident_id, created_at ASC);

-- -- 8. Alert Engine (Fase 3) ----------------------------------
CREATE TABLE IF NOT EXISTS alert_channels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  kind          VARCHAR(20) NOT NULL,
  config        JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_enabled    BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at    TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);
CREATE INDEX IF NOT EXISTS idx_alert_channels_user ON alert_channels(user_id);

CREATE TABLE IF NOT EXISTS alert_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                  VARCHAR(120) NOT NULL,
  is_enabled            BOOLEAN NOT NULL DEFAULT true,
  monitor_id            UUID REFERENCES monitors(id) ON DELETE CASCADE,
  metric                VARCHAR(30) NOT NULL DEFAULT 'status_down',
  operator              VARCHAR(5)  NOT NULL DEFAULT '==',
  threshold             NUMERIC,
  for_seconds           INTEGER NOT NULL DEFAULT 0,
  severity              VARCHAR(20) NOT NULL DEFAULT 'major',
  cooldown_seconds      INTEGER NOT NULL DEFAULT 900,
  max_retries           INTEGER NOT NULL DEFAULT 3,
  retry_backoff_seconds INTEGER NOT NULL DEFAULT 60,
  priority              INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at            TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);
CREATE INDEX IF NOT EXISTS idx_alert_rules_user ON alert_rules(user_id, is_enabled);
CREATE INDEX IF NOT EXISTS idx_alert_rules_monitor ON alert_rules(monitor_id);

CREATE TABLE IF NOT EXISTS alert_rule_channels (
  rule_id           UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  channel_id        UUID NOT NULL REFERENCES alert_channels(id) ON DELETE CASCADE,
  escalation_step   INTEGER NOT NULL DEFAULT 0,
  delay_seconds     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (rule_id, channel_id, escalation_step)
);

CREATE TABLE IF NOT EXISTS alert_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id         UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  channel_id      UUID NOT NULL REFERENCES alert_channels(id) ON DELETE CASCADE,
  monitor_id      UUID REFERENCES monitors(id) ON DELETE SET NULL,
  incident_id     UUID REFERENCES incidents(id) ON DELETE SET NULL,
  fingerprint     TEXT NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempt         INTEGER NOT NULL DEFAULT 0,
  escalation_step INTEGER NOT NULL DEFAULT 0,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error      TEXT,
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  fired_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at      TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_due ON alert_deliveries(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_dedupe ON alert_deliveries(fingerprint, created_at DESC);

-- -- 9. Status Pages extras (Fase 4) ---------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme VARCHAR(20) NOT NULL DEFAULT 'system';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20) DEFAULT '#6366f1';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sla_target_pct NUMERIC(5,2) DEFAULT 99.90;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_uptime_history BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_incidents BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_maintenance BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS webhook_url TEXT;

CREATE TABLE IF NOT EXISTS maintenance_windows (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  created_at    TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at    TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  CONSTRAINT maintenance_ends_after_starts CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_maintenance_user ON maintenance_windows(user_id, starts_at DESC);

CREATE TABLE IF NOT EXISTS status_subscribers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email         VARCHAR(255) NOT NULL,
  is_verified   BOOLEAN NOT NULL DEFAULT false,
  verify_token  VARCHAR(64),
  created_at    TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE (user_id, email)
);
CREATE INDEX IF NOT EXISTS idx_status_subscribers_user ON status_subscribers(user_id);

-- -- 10. Mapa Mundial (Fase 6) ---------------------------------
CREATE TABLE IF NOT EXISTS map_regions (
  code          VARCHAR(20) PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  city          VARCHAR(100),
  country_code  CHAR(2) NOT NULL,
  latitude      NUMERIC(9, 6) NOT NULL,
  longitude     NUMERIC(9, 6) NOT NULL
);

INSERT INTO map_regions (code, name, city, country_code, latitude, longitude) VALUES
  ('gru', 'América do Sul', 'São Paulo', 'BR', -23.550500, -46.633300),
  ('iad', 'Leste dos EUA', 'Ashburn', 'US', 39.043800, -77.487400),
  ('sfo', 'Oeste dos EUA', 'San Francisco', 'US', 37.774900, -122.419400),
  ('lhr', 'Europa Oeste', 'Londres', 'GB', 51.507400, -0.127800),
  ('fra', 'Europa Central', 'Frankfurt', 'DE', 50.110900, 8.682100),
  ('cdg', 'Europa Sul', 'Paris', 'FR', 48.856600, 2.352200),
  ('sin', 'Sudeste Asiático', 'Singapura', 'SG', 1.352100, 103.819800),
  ('nrt', 'Ásia Leste', 'Tóquio', 'JP', 35.676200, 139.650300),
  ('syd', 'Oceania', 'Sydney', 'AU', -33.868800, 151.209300),
  ('dxb', 'Oriente Médio', 'Dubai', 'AE', 25.204800, 55.270800)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  city = EXCLUDED.city,
  country_code = EXCLUDED.country_code,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude;

ALTER TABLE monitors ADD COLUMN IF NOT EXISTS region_code VARCHAR(20) REFERENCES map_regions(code);
CREATE INDEX IF NOT EXISTS idx_monitors_region ON monitors(region_code);

-- -- 11. Analytics (Fase 7) ------------------------------------
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

-- -- 12. SSL (Fase 8) ------------------------------------------
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS ssl_issuer TEXT;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS ssl_subject TEXT;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS ssl_valid_from TIMESTAMPTZ;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS ssl_valid_to TIMESTAMPTZ;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS ssl_days_remaining INTEGER;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS ssl_protocol VARCHAR(40);
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS ssl_cipher VARCHAR(120);
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS ssl_fingerprint TEXT;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS ssl_warn_days INTEGER NOT NULL DEFAULT 30;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS ssl_last_warned_at TIMESTAMPTZ;

ALTER TABLE ping_logs ADD COLUMN IF NOT EXISTS ssl_meta JSONB;

CREATE INDEX IF NOT EXISTS idx_monitors_ssl_days
  ON monitors(ssl_days_remaining)
  WHERE check_type = 'ssl';

-- -- 13. DNS (Fase 9) ------------------------------------------
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS dns_last_records JSONB;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS dns_record_count INTEGER;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS dns_resolved_at TIMESTAMPTZ;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS dns_answers_preview TEXT;

ALTER TABLE ping_logs ADD COLUMN IF NOT EXISTS dns_meta JSONB;

CREATE INDEX IF NOT EXISTS idx_monitors_dns_type
  ON monitors(dns_record_type)
  WHERE check_type = 'dns';

