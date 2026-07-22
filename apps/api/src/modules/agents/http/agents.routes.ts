import { Router, Response, NextFunction } from 'express';
import { isAppError } from '@analytic-pulse/shared';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../../../middleware/auth';
import { AgentService } from '../services/AgentService';

const router = Router();
const service = new AgentService();

export interface AgentAuthenticatedRequest extends AuthenticatedRequest {
  agentId?: string;
}

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

async function requireAgentToken(
  req: AgentAuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  const raw =
    header?.startsWith('Bearer ')
      ? header.slice(7)
      : typeof req.headers['x-agent-token'] === 'string'
        ? req.headers['x-agent-token']
        : '';

  if (!raw || !raw.startsWith('ap_agent_')) {
    res.status(401).json({ error: 'Missing or invalid agent token' });
    return;
  }

  try {
    const agent = await service.findByToken(raw);
    if (!agent) {
      res.status(401).json({ error: 'Invalid agent token' });
      return;
    }
    req.agentId = agent.id;
    next();
  } catch {
    res.status(401).json({ error: 'Agent auth failed' });
  }
}

/** Ingestão autenticada por token do agent (sem JWT de usuário) */
router.post('/ingest', requireAgentToken as never, async (req: AgentAuthenticatedRequest, res) => {
  try {
    const agent = await service.ingest(req.agentId!, req.body ?? {});
    return res.json({ ok: true, agent_id: agent.id, status: agent.status });
  } catch (error) {
    return handleError(res, error);
  }
});

router.use(requireAuth as never);

router.get('/overview', async (req: AuthenticatedRequest, res) => {
  try {
    return res.json(await service.list(req.userId!));
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const created = await service.create(req.userId!, req.body);
    return res.status(201).json(created);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
    return res.json(await service.getById(req.userId!, id));
  } catch (error) {
    return handleError(res, error);
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
    await service.delete(req.userId!, id);
    return res.status(204).send();
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;
