-- Fase 6: Mapa Mundial — regiões geográficas + vínculo aos monitores
-- Idempotente: seguro reexecutar.

CREATE TABLE IF NOT EXISTS map_regions (
  code          VARCHAR(20) PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  city          VARCHAR(100),
  country_code  CHAR(2) NOT NULL,
  latitude      NUMERIC(9, 6) NOT NULL,
  longitude     NUMERIC(9, 6) NOT NULL
);

INSERT INTO map_regions (code, name, city, country_code, latitude, longitude) VALUES
  ('gru', 'América do Sul', 'São Paulo', 'BR', -23.550500, -46.633300),
  ('iad', 'Leste dos EUA', 'Ashburn', 'US', 39.043800, -77.487400),
  ('sfo', 'Oeste dos EUA', 'San Francisco', 'US', 37.774900, -122.419400),
  ('lhr', 'Europa Oeste', 'Londres', 'GB', 51.507400, -0.127800),
  ('fra', 'Europa Central', 'Frankfurt', 'DE', 50.110900, 8.682100),
  ('cdg', 'Europa Sul', 'Paris', 'FR', 48.856600, 2.352200),
  ('sin', 'Sudeste Asiático', 'Singapura', 'SG', 1.352100, 103.819800),
  ('nrt', 'Ásia Leste', 'Tóquio', 'JP', 35.676200, 139.650300),
  ('syd', 'Oceania', 'Sydney', 'AU', -33.868800, 151.209300),
  ('dxb', 'Oriente Médio', 'Dubai', 'AE', 25.204800, 55.270800)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  city = EXCLUDED.city,
  country_code = EXCLUDED.country_code,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude;

ALTER TABLE monitors ADD COLUMN IF NOT EXISTS region_code VARCHAR(20) REFERENCES map_regions(code);

CREATE INDEX IF NOT EXISTS idx_monitors_region ON monitors(region_code);

-- Backfill: monitores sem região → São Paulo (padrão)
UPDATE monitors SET region_code = 'gru' WHERE region_code IS NULL;
