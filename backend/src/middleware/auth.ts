import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

/**
 * Middleware that validates a Supabase JWT from the Authorization header.
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
    // Use the anon key to verify the user's JWT
    const supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabaseClient.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    req.userId = data.user.id;
    next();
  } catch {
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
