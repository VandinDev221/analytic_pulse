-- Fase 8: SSL — snapshot do certificado + histórico + limiar de aviso
-- Idempotente.

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
