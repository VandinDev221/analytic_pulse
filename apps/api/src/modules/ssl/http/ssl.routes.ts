import { Router, Response } from 'express';
import { isAppError } from '@analytic-pulse/shared';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../../../middleware/auth';
import { SslService } from '../services/SslService';

const router = Router();
const service = new SslService();

router.use(requireAuth as never);

function handleError(res: Response, error: unknown) {
  if (isAppError(error)) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
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

export default router;
