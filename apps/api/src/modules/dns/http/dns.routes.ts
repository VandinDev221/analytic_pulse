import { Router, Response } from 'express';
import { isAppError } from '@analytic-pulse/shared';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../../../middleware/auth';
import { DnsService } from '../services/DnsService';

const router = Router();
const service = new DnsService();

router.use(requireAuth as never);

function handleError(res: Response, error: unknown) {
  if (isAppError(error)) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      details: error.details,
    });
  }
  const message = error instanceof Error ? error.message : 'Internal server error';
  return res.status(500).json({ error: message });
}

router.get('/overview', async (req: AuthenticatedRequest, res) => {
  try {
    return res.json(await service.getOverview(req.userId!));
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/scan', async (req: AuthenticatedRequest, res) => {
  try {
    const host = typeof req.query.host === 'string' ? req.query.host : '';
    return res.json(await service.scanDomain(host));
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;
