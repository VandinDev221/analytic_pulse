import { Pool } from 'pg';
import { env } from '../config/env';
import { logger } from '../observability/logger';

/**
 * Normaliza a connection string para evitar o aviso de deprecição do `pg`
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

export async function getDatabaseMetrics() {
  if (!connectionString) {
    return null;
  }

  try {
    // Database size
    const sizeResult = await pool.query<{ size: string; size_pretty: string }>(
      `SELECT pg_database_size(current_database()) AS size,
              pg_size_pretty(pg_database_size(current_database())) AS size_pretty`
    );

    // Table count
    const tableResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM information_schema.tables WHERE table_schema = 'public'`
    );

    // Active connections
    const connResult = await pool.query<{ active: string; idle: string; total: string }>(
      `SELECT
        COUNT(*) FILTER (WHERE state = 'active')::text AS active,
        COUNT(*) FILTER (WHERE state = 'idle')::text AS idle,
        COUNT(*)::text AS total
      FROM pg_stat_activity
      WHERE datname = current_database()`
    );

    // Row estimates for main tables
    const rowsResult = await pool.query<{ table_name: string; row_estimate: string }>(
      `SELECT relname AS table_name, reltuples::bigint::text AS row_estimate
       FROM pg_class
       WHERE relnamespace = 'public'::regnamespace
         AND relkind = 'r'
       ORDER BY reltuples DESC
       LIMIT 10`
    );

    const row = sizeResult.rows[0];
    const conn = connResult.rows[0];

    return {
      size: {
        bytes: Number(row?.size || 0),
        pretty: row?.size_pretty || '0 bytes',
      },
      tables: Number(tableResult.rows[0]?.count || 0),
      connections: {
        active: Number(conn?.active || 0),
        idle: Number(conn?.idle || 0),
        total: Number(conn?.total || 0),
        pool_total: pool.totalCount,
        pool_idle: pool.idleCount,
        pool_waiting: pool.waitingCount,
      },
      top_tables: rowsResult.rows.map((r) => ({
        name: r.table_name,
        rows: Number(r.row_estimate),
      })),
    };
  } catch {
    return null;
  }
}
