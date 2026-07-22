-- Fase 13: API pública — chaves de acesso (ap_pk_...)
-- Idempotente.

CREATE TABLE IF NOT EXISTS api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(120) NOT NULL,
  token_hash      VARCHAR(64) NOT NULL UNIQUE,
  token_prefix    VARCHAR(16) NOT NULL,
  scopes          TEXT[] NOT NULL DEFAULT ARRAY['read', 'write']::TEXT[],
  last_used_at    TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_token_hash ON api_keys(token_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active
  ON api_keys(user_id)
  WHERE revoked_at IS NULL;
