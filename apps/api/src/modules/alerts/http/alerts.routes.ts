import { Router, Response } from 'express';
import { isAppError } from '@analytic-pulse/shared';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../../../middleware/auth';
import { PgAlertDeliveryRepository } from '../repositories/PgAlertDeliveryRepository';
import {
  PgAlertChannelRepository,
  PgAlertRuleRepository,
} from '../repositories/PgAlertRepositories';
import { AlertService } from '../services/AlertService';

const router = Router();
const service = new AlertService(
  new PgAlertChannelRepository(),
  new PgAlertRuleRepository(),
  new PgAlertDeliveryRepository()
);

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

function paramId(req: AuthenticatedRequest): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0]! : id!;
}

// ── Channels ──────────────────────────────────────────────────

router.get('/channels', async (req: AuthenticatedRequest, res: Response) => {
  try {
    return res.json(await service.listChannels(req.userId!));
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/channels', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const channel = await service.createChannel(req.userId!, req.body);
    return res.status(201).json(channel);
  } catch (error) {
    return handleError(res, error);
  }
});

router.patch('/channels/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const channel = await service.updateChannel(
      paramId(req),
      req.userId!,
      req.body
    );
    return res.json(channel);
  } catch (error) {
    return handleError(res, error);
  }
});

router.delete('/channels/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await service.deleteChannel(paramId(req), req.userId!);
    return res.status(204).send();
  } catch (error) {
    return handleError(res, error);
  }
});

// ── Rules ─────────────────────────────────────────────────────

router.get('/rules', async (req: AuthenticatedRequest, res: Response) => {
  try {
    return res.json(await service.listRules(req.userId!));
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/rules', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rule = await service.createRule(req.userId!, req.body);
    return res.status(201).json(rule);
  } catch (error) {
    return handleError(res, error);
  }
});

router.patch('/rules/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rule = await service.updateRule(paramId(req), req.userId!, req.body);
    return res.json(rule);
  } catch (error) {
    return handleError(res, error);
  }
});

router.delete('/rules/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await service.deleteRule(paramId(req), req.userId!);
    return res.status(204).send();
  } catch (error) {
    return handleError(res, error);
  }
});

// ── Deliveries ────────────────────────────────────────────────

router.get('/deliveries', async (req: AuthenticatedRequest, res: Response) => {
  try {
    return res.json(await service.listDeliveries(req.userId!));
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;
