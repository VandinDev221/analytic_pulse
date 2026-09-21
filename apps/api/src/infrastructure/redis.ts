import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../observability/logger';

export let redis: Redis | null = null;

if (env.redisUrl) {
  try {
    redis = new Redis(env.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          return null; // Stop retrying
        }
        return Math.min(times * 100, 3000);
      }
    });

    redis.on('error', (err) => {
      logger.error('Redis connection error', { error: err.message });
    });

    redis.on('connect', () => {
      logger.info('Connected to Redis successfully');
    });
  } catch (error) {
    logger.error('Failed to initialize Redis', { error });
  }
} else {
  logger.warn('REDIS_URL not configured. Redis features will be disabled.');
}

export async function checkRedis(): Promise<{ connected: boolean; error?: string }> {
  if (!redis) {
    return { connected: false, error: 'REDIS_URL not configured' };
  }
  
  try {
    await redis.ping();
    return { connected: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown Redis error';
    return { connected: false, error: message };
  }
}
