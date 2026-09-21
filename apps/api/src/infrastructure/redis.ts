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
          return null;
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

export async function getRedisMetrics() {
  if (!redis) {
    return null;
  }

  try {
    const info = await redis.info();
    const parse = (key: string): string | null => {
      const regex = new RegExp('^' + key + ':(.+)$', 'm');
      const match = info.match(regex);
      return match ? match[1].trim() : null;
    };

    const usedMemory = Number(parse('used_memory') || 0);
    const maxMemory = Number(parse('maxmemory') || 0);
    const totalKeys = await redis.dbsize();

    const hits = Number(parse('keyspace_hits') || 0);
    const misses = Number(parse('keyspace_misses') || 0);
    const hitTotal = hits + misses;

    return {
      memory: {
        used_bytes: usedMemory,
        used_mb: +(usedMemory / 1024 / 1024).toFixed(2),
        max_bytes: maxMemory,
        max_mb: maxMemory > 0 ? +(maxMemory / 1024 / 1024).toFixed(2) : null,
        usage_pct: maxMemory > 0 ? +((usedMemory / maxMemory) * 100).toFixed(1) : null,
      },
      clients: {
        connected: Number(parse('connected_clients') || 0),
        blocked: Number(parse('blocked_clients') || 0),
      },
      stats: {
        total_commands: Number(parse('total_commands_processed') || 0),
        ops_per_sec: Number(parse('instantaneous_ops_per_sec') || 0),
        hit_rate: hitTotal > 0 ? +((hits / hitTotal) * 100).toFixed(1) : null,
        total_keys: totalKeys,
      },
      server: {
        version: parse('redis_version'),
        uptime_seconds: Number(parse('uptime_in_seconds') || 0),
        uptime_days: Number(parse('uptime_in_days') || 0),
      },
    };
  } catch {
    return null;
  }
}
