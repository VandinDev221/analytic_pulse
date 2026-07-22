import { Pool } from 'pg';
import { env } from '../config/env';
import { logger } from '../observability/logger';

/**
 * Normaliza a connection string para evitar o aviso de depreciação do `pg`
 * (sslmode=require tratado como verify-full). Mantém o comportamento atual
 * via `ssl: { rejectUnauthorized: false }` no Pool e compatibilidade libpq.
 */
function normalizeDatabaseUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    const mode = parsed.searchParams.get('sslmode');
    if (mode === 'require' || mode === 'prefer' || mode === 'verify-ca') {
      parsed.searchParams.set('uselibpqcompat', 'true');
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

const connectionString = normalizeDatabaseUrl(env.databaseUrl);

const isLocal =
  connectionString?.includes('localhost') ||
  connectionString?.includes('127.0.0.1');

export const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 15_000,
});

pool.on('error', (err) => {
  logger.error('Postgres pool error', { error: err.message });
});

export const query = (text: string, params?: unknown[]) => pool.query(text, params);

export async function checkDatabase(): Promise<{
  connected: boolean;
  schema_ready: boolean;
  error?: string;
}> {
  if (!connectionString) {
    return {
      connected: false,
      schema_ready: false,
      error: 'DATABASE_URL / POSTGRES_URL não configurado',
    };
  }

  try {
    await pool.query('SELECT 1');
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
      ) AS exists`
    );
    return {
      connected: true,
      schema_ready: result.rows[0]?.exists === true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return { connected: false, schema_ready: false, error: message };
  }
}
