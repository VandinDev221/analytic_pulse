import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-super-secret-key-change-me';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

/**
 * Middleware that validates a custom JWT from the Authorization header.
 * Sets req.userId on success.
 */
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
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    if (!decoded || !decoded.userId) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token verification failed' });
  }
}

/**
 * Middleware that validates the cron secret key to protect the cron endpoint.
 */
export function requireCronSecret(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  const expectedSecret = process.env.CRON_SECRET;

  // If no secret is configured, allow the request (dev mode)
  if (!expectedSecret) {
    next();
    return;
  }

  if (secret !== expectedSecret) {
    res.status(403).json({ error: 'Forbidden: invalid cron secret' });
    return;
  }

  next();
}
