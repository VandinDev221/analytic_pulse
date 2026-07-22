import { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth';

type Bucket = {
  count: number;
  resetAt: number;
};

export type RateLimitOptions = {
  windowMs: number;
  max: number;
  /** Chave de isolamento (ex.: userId). */
  keyFn: (req: AuthenticatedRequest) => string;
  message?: string;
};

/**
 * Rate limiter em memória por chave (adequado a instância única).
 */
export function createRateLimiter(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  const message =
    options.message ?? 'Muitas requisições. Tente novamente em instantes.';

  // Evita crescimento indefinido do Map
  const CLEANUP_EVERY = 200;
  let hits = 0;

  return function rateLimit(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void {
    hits += 1;
    if (hits % CLEANUP_EVERY === 0) {
      const now = Date.now();
      for (const [key, bucket] of buckets) {
        if (now >= bucket.resetAt) buckets.delete(key);
      }
    }

    const key = options.keyFn(req);
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    const retryAfterSec = Math.max(
      1,
      Math.ceil((bucket.resetAt - now) / 1000)
    );
    res.setHeader('X-RateLimit-Limit', String(options.max));
    res.setHeader(
      'X-RateLimit-Remaining',
      String(Math.max(0, options.max - bucket.count))
    );
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > options.max) {
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: message,
        code: 'RATE_LIMIT',
      });
      return;
    }

    next();
  };
}
