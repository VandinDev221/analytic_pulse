-- ============================================================
-- Migration: Fase 2 — Incident System
-- Idempotente
-- ============================================================

CREATE TABLE IF NOT EXISTS incidents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             VARCHAR(200) NOT NULL,
  status            VARCHAR(30)  NOT NULL DEFAULT 'open',
  -- open | acknowledged | investigating | resolved
  severity          VARCHAR(20)  NOT NULL DEFAULT 'major',
  -- critical | high | major | minor | low
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
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id  UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  event_type   VARCHAR(50) NOT NULL,
  -- monitor_down | monitor_up | alert_sent | incident_opened |
  -- incident_acknowledged | incident_investigating | incident_resolved |
  -- comment_added | note_updated | severity_changed | root_cause_updated | system
  message      TEXT NOT NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata     JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
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
