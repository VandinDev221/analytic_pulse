import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as { userId: string };

    if (!decoded || !decoded.userId) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Token verification failed' });
  }
}

export function requireCronSecret(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  const expectedSecret = env.cronSecret;

  if (!expectedSecret) {
    if (env.isProduction) {
      res.status(503).json({ error: 'CRON_SECRET not configured' });
      return;
    }
    next();
    return;
  }

  if (secret !== expectedSecret) {
    res.status(403).json({ error: 'Forbidden: invalid cron secret' });
    return;
  }

  next();
}
