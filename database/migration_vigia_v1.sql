-- Fase Vigia (V0–V6): agente watchman 24/7
-- Idempotente.

CREATE TABLE IF NOT EXISTS vigia_sessions (
  user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mode              VARCHAR(20) NOT NULL DEFAULT 'observe',
  -- observe | remediate | pause
  last_greeting_at  TIMESTAMPTZ,
  last_round_at     TIMESTAMPTZ,
  last_digest_at    TIMESTAMPTZ,
  circuit_open_until TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  config            JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS vigia_actions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  playbook_id   VARCHAR(60),
  -- null quando só proposta/classificação
  severity      VARCHAR(20) NOT NULL DEFAULT 'info',
  -- info | warn | critical | actionable
  status        VARCHAR(20) NOT NULL DEFAULT 'proposed',
  -- proposed | running | succeeded | failed | skipped | notified
  title         VARCHAR(200) NOT NULL,
  explanation   TEXT,
  target_type   VARCHAR(40),
  target_id     UUID,
  input         JSONB NOT NULL DEFAULT '{}'::jsonb,
  result        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  finished_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vigia_actions_user ON vigia_actions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vigia_actions_status ON vigia_actions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_vigia_actions_playbook ON vigia_actions(user_id, playbook_id);

CREATE TABLE IF NOT EXISTS vigia_digests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start  TIMESTAMPTZ NOT NULL,
  period_end    TIMESTAMPTZ NOT NULL,
  summary       JSONB NOT NULL DEFAULT '{}'::jsonb,
  text_html     TEXT,
  delivered_telegram BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_vigia_digests_user ON vigia_digests(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS vigia_rounds (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  finished_at   TIMESTAMPTZ,
  mode          VARCHAR(20) NOT NULL,
  findings      INTEGER NOT NULL DEFAULT 0,
  actions_run   INTEGER NOT NULL DEFAULT 0,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_vigia_rounds_user ON vigia_rounds(user_id, started_at DESC);
