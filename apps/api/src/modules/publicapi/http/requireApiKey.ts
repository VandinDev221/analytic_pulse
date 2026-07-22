import type { Response, NextFunction } from 'express';
import type { ApiKey, ApiKeyScope } from '@analytic-pulse/shared';
import {
  type AuthenticatedRequest,
} from '../../../middleware/auth';
import { ApiKeyService } from '../services/ApiKeyService';

export interface ApiKeyRequest extends AuthenticatedRequest {
  apiKey?: ApiKey;
  apiKeyId?: string;
}

const service = new ApiKeyService();

function extractToken(req: ApiKeyRequest): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  const xKey = req.headers['x-api-key'];
  if (typeof xKey === 'string' && xKey.trim()) return xKey.trim();
  if (Array.isArray(xKey) && xKey[0]) return xKey[0].trim();
  return null;
}

export async function requireApiKey(
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({
      error: 'Missing API key — use Authorization: Bearer ap_pk_... or X-Api-Key',
    });
    return;
  }

  try {
    const key = await service.findByToken(token);
    if (!key) {
      res.status(401).json({ error: 'Invalid or revoked API key' });
      return;
    }
    req.userId = key.user_id;
    req.apiKey = key;
    req.apiKeyId = key.id;
    next();
  } catch {
    res.status(401).json({ error: 'API key verification failed' });
  }
}

export function requireScope(scope: ApiKeyScope) {
  return (req: ApiKeyRequest, res: Response, next: NextFunction): void => {
    const scopes = req.apiKey?.scopes || [];
    if (scopes.includes(scope)) {
      next();
      return;
    }
    // write implies read
    if (scope === 'read' && scopes.includes('write')) {
      next();
      return;
    }
    res.status(403).json({ error: `API key missing scope: ${scope}` });
  };
}
