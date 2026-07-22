import { Router, Response } from 'express';
import { isAppError } from '@analytic-pulse/shared';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../../../middleware/auth';
import { createRateLimiter } from '../../../middleware/rateLimit';
import { AssistantService } from '../services/AssistantService';

const router = Router();
const service = new AssistantService();

router.use(requireAuth as never);

/** Protege custo Groq: 20 req/min por usuário autenticado. */
const aiChatRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 20,
  keyFn: (req) => `ai:chat:${req.userId ?? 'anon'}`,
  message: 'Limite de mensagens do assistente atingido. Aguarde um minuto.',
});

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

router.post('/chat', aiChatRateLimit as never, async (req: AuthenticatedRequest, res) => {
  try {
    const message = await service.chat(req.body?.messages);
    return res.json({ message });
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;
