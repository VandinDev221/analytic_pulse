import { Router, Request, Response } from 'express';
import { requireCronSecret } from '../../../middleware/auth';
import { logger } from '../../../observability/logger';
import { PgMonitorRepository } from '../repositories/PgMonitorRepository';
import { CheckOrchestrator } from '../services/CheckOrchestrator';
import { VigiaService } from '../../vigia/services/VigiaService';

const router = Router();
const orchestrator = new CheckOrchestrator(new PgMonitorRepository());
const vigia = new VigiaService();

router.get('/ping', requireCronSecret, async (_req: Request, res: Response) => {
  try {
    const result = await orchestrator.runPingCycle();

    if (result.processed === 0) {
      return res.json({ message: 'No active monitors found', processed: 0 });
    }

    return res.json({
      message: 'Ping cycle complete',
      ...result,
    });
  } catch (err) {
    logger.error('Cron ping error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return res.status(500).json({ error: 'Internal server error during cron ping' });
  }
});

/** Digest diário + ronda sentinela do Vigia (chame a cada 5–15 min). */
router.post('/vigia', requireCronSecret, async (_req: Request, res: Response) => {
  try {
    const result = await vigia.runCronTick();
    return res.json({ message: 'Vigia cron complete', ...result });
  } catch (err) {
    logger.error('Cron vigia error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return res.status(500).json({ error: 'Internal server error during vigia cron' });
  }
});

router.get('/vigia-digest', requireCronSecret, async (_req: Request, res: Response) => {
  try {
    const result = await vigia.runCronTick();
    return res.json({ message: 'Vigia digest tick', ...result });
  } catch (err) {
    logger.error('Cron vigia-digest error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return res.status(500).json({ error: 'Internal server error during vigia digest' });
  }
});

export default router;
