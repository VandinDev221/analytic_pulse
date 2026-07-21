-- ============================================================
-- Migration: Fase 1 — Monitoring expandido
-- Idempotente (ADD COLUMN IF NOT EXISTS)
-- ============================================================

-- Monitors: tipo de check + alvo + validações
ALTER TABLE monitors
  ADD COLUMN IF NOT EXISTS check_type VARCHAR(20) NOT NULL DEFAULT 'http';

ALTER TABLE monitors
  ADD COLUMN IF NOT EXISTS host VARCHAR(255);

ALTER TABLE monitors
  ADD COLUMN IF NOT EXISTS port INTEGER;

ALTER TABLE monitors
  ADD COLUMN IF NOT EXISTS dns_record_type VARCHAR(10) DEFAULT 'A';

ALTER TABLE monitors
  ADD COLUMN IF NOT EXISTS keyword TEXT;

ALTER TABLE monitors
  ADD COLUMN IF NOT EXISTS expected_status_codes JSONB DEFAULT '[200,201,202,204,301,302,304]'::jsonb;

ALTER TABLE monitors
  ADD COLUMN IF NOT EXISTS expected_header_name VARCHAR(120);

ALTER TABLE monitors
  ADD COLUMN IF NOT EXISTS expected_header_value TEXT;

ALTER TABLE monitors
  ADD COLUMN IF NOT EXISTS json_path TEXT;

ALTER TABLE monitors
  ADD COLUMN IF NOT EXISTS json_expected TEXT;

ALTER TABLE monitors
  ADD COLUMN IF NOT EXISTS request_headers JSONB DEFAULT '{}'::jsonb;

ALTER TABLE monitors
  ADD COLUMN IF NOT EXISTS request_body TEXT;

CREATE INDEX IF NOT EXISTS idx_monitors_check_type ON monitors(check_type);

-- Ping logs: timings e metadados de resposta
ALTER TABLE ping_logs
  ADD COLUMN IF NOT EXISTS check_type VARCHAR(20);

ALTER TABLE ping_logs
  ADD COLUMN IF NOT EXISTS dns_ms INTEGER;

ALTER TABLE ping_logs
  ADD COLUMN IF NOT EXISTS tcp_ms INTEGER;

ALTER TABLE ping_logs
  ADD COLUMN IF NOT EXISTS tls_ms INTEGER;

ALTER TABLE ping_logs
  ADD COLUMN IF NOT EXISTS ttfb_ms INTEGER;

ALTER TABLE ping_logs
  ADD COLUMN IF NOT EXISTS download_ms INTEGER;

ALTER TABLE ping_logs
  ADD COLUMN IF NOT EXISTS response_size_bytes INTEGER;

ALTER TABLE ping_logs
  ADD COLUMN IF NOT EXISTS content_length INTEGER;

ALTER TABLE ping_logs
  ADD COLUMN IF NOT EXISTS response_headers JSONB;

ALTER TABLE ping_logs
  ADD COLUMN IF NOT EXISTS redirect_chain JSONB;
