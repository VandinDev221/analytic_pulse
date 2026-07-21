-- ============================================================
-- Migration: Fase 3 — Alert Engine
-- Idempotente
-- ============================================================

CREATE TABLE IF NOT EXISTS alert_channels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  kind          VARCHAR(20) NOT NULL,
  -- telegram | whatsapp | email | slack | webhook | discord | teams
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
  -- status_down | latency_ms | http_status | is_up
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
  -- pending | sent | failed | suppressed
  attempt         INTEGER NOT NULL DEFAULT 0,
  escalation_step INTEGER NOT NULL DEFAULT 0,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error      TEXT,
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  fired_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at      TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_alert_deliveries_due
  ON alert_deliveries(status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_alert_deliveries_dedupe
  ON alert_deliveries(fingerprint, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_deliveries_rule
  ON alert_deliveries(rule_id, created_at DESC);
