-- Fase: IA RCA automática (análise ao abrir incidente)
-- Idempotente. Não altera root_cause — só armazena sugestão da IA.

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS ai_analysis JSONB,
  ADD COLUMN IF NOT EXISTS ai_analysis_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMPTZ;

-- none|pending|ready|failed|skipped — NULL = nunca tentou

CREATE INDEX IF NOT EXISTS idx_incidents_ai_status
  ON incidents(user_id, ai_analysis_status)
  WHERE ai_analysis_status IS NOT NULL;
