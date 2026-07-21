-- Fase 9: DNS — snapshot de resolução + histórico
-- Idempotente.

ALTER TABLE monitors ADD COLUMN IF NOT EXISTS dns_last_records JSONB;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS dns_record_count INTEGER;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS dns_resolved_at TIMESTAMPTZ;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS dns_answers_preview TEXT;

ALTER TABLE ping_logs ADD COLUMN IF NOT EXISTS dns_meta JSONB;

CREATE INDEX IF NOT EXISTS idx_monitors_dns_type
  ON monitors(dns_record_type)
  WHERE check_type = 'dns';
