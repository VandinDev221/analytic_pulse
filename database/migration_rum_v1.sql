-- Fase: Real User Monitoring (RUM)
-- Idempotente.

CREATE TABLE IF NOT EXISTS rum_sites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(120) NOT NULL,
  origin_allow    VARCHAR(500),
  token_hash      VARCHAR(64) NOT NULL UNIQUE,
  token_prefix    VARCHAR(16) NOT NULL,
  last_seen_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_rum_sites_user ON rum_sites(user_id);
CREATE INDEX IF NOT EXISTS idx_rum_sites_token_hash ON rum_sites(token_hash);

CREATE TABLE IF NOT EXISTS rum_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES rum_sites(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type      VARCHAR(40) NOT NULL,
  name            VARCHAR(200),
  value           DOUBLE PRECISION,
  url             TEXT,
  path            TEXT,
  referrer        TEXT,
  user_agent      TEXT,
  session_id      VARCHAR(64),
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_rum_events_user_created
  ON rum_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rum_events_site_created
  ON rum_events(site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rum_events_type_created
  ON rum_events(user_id, event_type, created_at DESC);
