import { Router, Response } from 'express';
import { isAppError } from '@analytic-pulse/shared';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../../../middleware/auth';
import { createRateLimiter } from '../../../middleware/rateLimit';
import { VigiaService } from '../services/VigiaService';
import { VigiaChatService } from '../services/VigiaChatService';

const router = Router();
const service = new VigiaService();
const chat = new VigiaChatService();

function handleError(res: Response, error: unknown): void {
  if (isAppError(error)) {
    res.status(error.statusCode).json({ error: error.message, code: error.code });
    return;
  }
  console.error('Vigia route error:', error);
  const message = error instanceof Error ? error.message : 'Internal server error';
  // Postgres: migration faltando ou coluna inválida
  if (/relation .* does not exist|column .* does not exist/i.test(message)) {
    res.status(503).json({
      error:
        'Schema do Vigia incompleto. Execute database/migration_vigia_v1.sql no Postgres.',
      detail: message,
    });
    return;
  }
  res.status(500).json({ error: 'Internal server error', detail: message });
}

const chatLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 20,
  keyFn: (req) => `vigia:chat:${req.userId}`,
  message: 'Muitas mensagens ao Vigia. Aguarde um minuto.',
});

router.use(requireAuth as never);

router.get('/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = await service.getStatus(req.userId!);
    res.json(status);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/greeting', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const greeting = await service.greeting(req.userId!);
    res.json(greeting);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/overview', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const overview = await service.overview(req.userId!);
    res.json(overview);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/actions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const actions = await service.listActions(req.userId!);
    res.json({ actions });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/proposed', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const actions = await service.listProposed(req.userId!);
    res.json({ actions });
  } catch (error) {
    handleError(res, error);
  }
});

router.patch('/mode', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = await service.setMode(req.userId!, req.body?.mode);
    res.json(status);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/digest', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const digest = await service.generateDigest(req.userId!, {
      deliverTelegram: req.body?.telegram !== false,
    });
    res.json(digest);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/round', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await service.runRound(req.userId!);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post(
  '/chat',
  chatLimiter as never,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const message = await chat.chat(req.userId!, req.body?.messages);
      res.json({ message });
    } catch (error) {
      handleError(res, error);
    }
  }
);

export default router;
