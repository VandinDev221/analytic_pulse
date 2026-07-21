import { Router, Request, Response } from 'express';
import { requireCronSecret } from '../../../middleware/auth';
import { logger } from '../../../observability/logger';
import { PgMonitorRepository } from '../repositories/PgMonitorRepository';
import { CheckOrchestrator } from '../services/CheckOrchestrator';

const router = Router();
const orchestrator = new CheckOrchestrator(new PgMonitorRepository());

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

export default router;
