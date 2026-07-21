-- ============================================================
-- Migration: Fase 4 — Status Pages profissionais
-- Idempotente
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS theme VARCHAR(20) NOT NULL DEFAULT 'system';
  -- system | light | dark

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20) DEFAULT '#6366f1';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS sla_target_pct NUMERIC(5,2) DEFAULT 99.90;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS show_uptime_history BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS show_incidents BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS show_maintenance BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS webhook_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_custom_domain
  ON profiles(custom_domain)
  WHERE custom_domain IS NOT NULL AND custom_domain <> '';

CREATE TABLE IF NOT EXISTS maintenance_windows (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  -- scheduled | active | completed | cancelled
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
