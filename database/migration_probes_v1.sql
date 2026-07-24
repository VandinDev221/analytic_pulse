-- Fase: Probes regionais (agents kind=probe + origem do check)
-- Idempotente.

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'host',
  ADD COLUMN IF NOT EXISTS region_code VARCHAR(20);

-- host | probe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agents_region_code_fkey'
  ) THEN
    ALTER TABLE agents
      ADD CONSTRAINT agents_region_code_fkey
      FOREIGN KEY (region_code) REFERENCES map_regions(code);
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL; -- map_regions ainda não existe
END $$;

CREATE INDEX IF NOT EXISTS idx_agents_kind_region ON agents(kind, region_code);
CREATE INDEX IF NOT EXISTS idx_agents_user_kind ON agents(user_id, kind);

ALTER TABLE monitors
  ADD COLUMN IF NOT EXISTS last_probe_region VARCHAR(20);

ALTER TABLE ping_logs
  ADD COLUMN IF NOT EXISTS probe_region VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_ping_logs_probe_region ON ping_logs(probe_region);
