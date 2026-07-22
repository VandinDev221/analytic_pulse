import crypto from 'crypto';
import type {
  ApiKey,
  ApiKeyCreated,
  ApiKeyScope,
  ApiKeysOverview,
  CreateApiKeyInput,
} from '@analytic-pulse/shared';
import { NotFoundError, ValidationError } from '@analytic-pulse/shared';
import { query } from '../../../infrastructure/db';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken(): { token: string; prefix: string; hash: string } {
  const raw = crypto.randomBytes(24).toString('base64url');
  const token = `ap_pk_${raw}`;
  return {
    token,
    prefix: token.slice(0, 12),
    hash: hashToken(token),
  };
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  return new Date(value).toISOString();
}

function mapKey(row: Record<string, unknown>): ApiKey {
  const scopesRaw = row.scopes;
  const scopes = Array.isArray(scopesRaw)
    ? (scopesRaw as ApiKeyScope[])
    : (['read', 'write'] as ApiKeyScope[]);

  return {
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    token_prefix: row.token_prefix as string,
    scopes,
    last_used_at: toIso(row.last_used_at as Date | string | null),
    revoked_at: toIso(row.revoked_at as Date | string | null),
    created_at: toIso(row.created_at as Date | string)!,
  };
}

export class ApiKeyService {
  async create(
    userId: string,
    input: CreateApiKeyInput
  ): Promise<ApiKeyCreated> {
    if (!input.name?.trim()) throw new ValidationError('name is required');

    const scopes = (input.scopes?.length
      ? input.scopes
      : (['read', 'write'] as ApiKeyScope[])
    ).filter((s) => s === 'read' || s === 'write');

    if (!scopes.length) {
      throw new ValidationError('scopes must include read and/or write');
    }

    const { token, prefix, hash } = generateToken();
    const result = await query(
      `INSERT INTO api_keys (user_id, name, token_hash, token_prefix, scopes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, input.name.trim(), hash, prefix, scopes]
    );

    return { ...mapKey(result.rows[0]), token };
  }

  async list(userId: string): Promise<ApiKeysOverview> {
    const result = await query(
      `SELECT * FROM api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return { keys: result.rows.map(mapKey) };
  }

  async revoke(userId: string, id: string): Promise<void> {
    const result = await query(
      `UPDATE api_keys
       SET revoked_at = TIMEZONE('utc', NOW())
       WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
       RETURNING id`,
      [id, userId]
    );
    if (!result.rowCount) throw new NotFoundError('API key');
  }

  async findByToken(token: string): Promise<ApiKey | null> {
    if (!token.startsWith('ap_pk_')) return null;
    const hash = hashToken(token);
    const result = await query(
      `SELECT * FROM api_keys
       WHERE token_hash = $1 AND revoked_at IS NULL
       LIMIT 1`,
      [hash]
    );
    if (!result.rows[0]) return null;

    await query(
      `UPDATE api_keys SET last_used_at = TIMEZONE('utc', NOW()) WHERE id = $1`,
      [result.rows[0].id]
    );

    return mapKey(result.rows[0]);
  }
}
