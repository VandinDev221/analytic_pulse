import { Router, Response } from 'express';
import { isAppError } from '@analytic-pulse/shared';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../../../middleware/auth';
import { AssistantService } from '../services/AssistantService';

const router = Router();
const service = new AssistantService();

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

router.post('/chat', async (req: AuthenticatedRequest, res) => {
  try {
    const message = await service.chat(req.body?.messages);
    return res.json({ message });
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;
