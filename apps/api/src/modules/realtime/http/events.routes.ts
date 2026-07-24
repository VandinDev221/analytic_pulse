import { Router, type Response } from 'express';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../../../middleware/auth';
import { realtimeHub, type RealtimeEvent } from '../RealtimeHub';
import { logger } from '../../../observability/logger';

const router = Router();

const HEARTBEAT_MS = 15_000;

function writeSse(res: Response, event: RealtimeEvent): void {
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

router.get(
  '/stream',
  requireAuth as never,
  (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId!;
    const log = logger.child({ component: 'RealtimeSSE', userId });

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof (res as Response & { flushHeaders?: () => void }).flushHeaders === 'function') {
      (res as Response & { flushHeaders: () => void }).flushHeaders();
    }

    writeSse(res, {
      type: 'connected',
      at: new Date().toISOString(),
      payload: { userId },
    });

    const unsubscribe = realtimeHub.subscribe(userId, (event) => {
      if (res.writableEnded) return;
      try {
        writeSse(res, event);
      } catch (error) {
        log.warn('Failed to write SSE event', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    const heartbeat = setInterval(() => {
      if (res.writableEnded) {
        clearInterval(heartbeat);
        return;
      }
      try {
        writeSse(res, {
          type: 'heartbeat',
          at: new Date().toISOString(),
        });
      } catch {
        clearInterval(heartbeat);
      }
    }, HEARTBEAT_MS);

    // Evita timeout ocioso em alguns proxies
    const socket = req.socket;
    if (socket) {
      socket.setTimeout(0);
      socket.setNoDelay(true);
      socket.setKeepAlive(true);
    }

    log.info('SSE client connected', {
      subscribers: realtimeHub.subscriberCount(userId),
    });

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
      log.info('SSE client disconnected', {
        subscribers: realtimeHub.subscriberCount(userId),
      });
    };

    req.on('close', cleanup);
    req.on('error', cleanup);
  }
);

export default router;
