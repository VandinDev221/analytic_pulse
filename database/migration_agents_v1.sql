-- Fase 10: Linux Agent — hosts, tokens e snapshots de métricas
-- Idempotente.

CREATE TABLE IF NOT EXISTS agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(120) NOT NULL,
  hostname        VARCHAR(255),
  token_hash      VARCHAR(64) NOT NULL UNIQUE,
  token_prefix    VARCHAR(16) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending | online | offline | disabled
  agent_version   VARCHAR(40),
  os_info         JSONB NOT NULL DEFAULT '{}'::jsonb,
  latest_metrics  JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_agents_user ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_token_hash ON agents(token_hash);
CREATE INDEX IF NOT EXISTS idx_agents_last_seen ON agents(last_seen_at DESC);

CREATE TABLE IF NOT EXISTS agent_snapshots (
  id              BIGSERIAL PRIMARY KEY,
  agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  collected_at    TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  cpu_pct         NUMERIC(5,2),
  mem_pct         NUMERIC(5,2),
  swap_pct        NUMERIC(5,2),
  disk_pct        NUMERIC(5,2),
  temperature_c   NUMERIC(6,2),
  load_1          NUMERIC(8,2),
  metrics         JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_agent_snapshots_agent_time
  ON agent_snapshots(agent_id, collected_at DESC);
