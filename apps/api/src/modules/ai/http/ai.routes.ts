import { Router, Response } from 'express';
import { isAppError } from '@analytic-pulse/shared';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../../../middleware/auth';
import { createRateLimiter } from '../../../middleware/rateLimit';
import { PgIncidentRepository } from '../../incidents/repositories/PgIncidentRepository';
import { IncidentService } from '../../incidents/services/IncidentService';
import { AssistantService } from '../services/AssistantService';
import { IncidentAnalyzerService } from '../services/IncidentAnalyzerService';

const router = Router();
const assistant = new AssistantService();
const analyzer = new IncidentAnalyzerService(
  new IncidentService(new PgIncidentRepository())
);

router.use(requireAuth as never);

/** Protege custo Groq: 20 req/min por usuário autenticado. */
const aiChatRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 20,
  keyFn: (req) => `ai:chat:${req.userId ?? 'anon'}`,
  message: 'Limite de mensagens do assistente atingido. Aguarde um minuto.',
});

/** Análise é mais cara — 5 req/min. */
const aiAnalyzeRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 5,
  keyFn: (req) => `ai:analyze:${req.userId ?? 'anon'}`,
  message: 'Limite de análises de IA atingido. Aguarde um minuto.',
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

function paramId(req: AuthenticatedRequest): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0]! : id!;
}

router.get('/status', async (_req: AuthenticatedRequest, res) => {
  try {
    return res.json(analyzer.getStatus());
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/chat', aiChatRateLimit as never, async (req: AuthenticatedRequest, res) => {
  try {
    const message = await assistant.chat(req.body?.messages);
    return res.json({ message });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post(
  '/analyze-incident/:id',
  aiAnalyzeRateLimit as never,
  async (req: AuthenticatedRequest, res) => {
    try {
      const analysis = await analyzer.analyze(req.userId!, paramId(req), {
        trigger: 'manual',
        force: true,
      });
      return res.json(analysis);
    } catch (error) {
      return handleError(res, error);
    }
  }
);

export default router;
