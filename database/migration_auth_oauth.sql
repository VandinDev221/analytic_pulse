-- Verificação por e-mail + login Google
-- Execute após schema.sql em bancos existentes

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- Contas antigas (só senha) já consideradas verificadas
UPDATE users SET email_verified = TRUE WHERE password_hash IS NOT NULL AND google_id IS NULL;

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
