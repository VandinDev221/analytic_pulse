import { Router, Response } from 'express';
import { isAppError } from '@analytic-pulse/shared';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../../../middleware/auth';
import { PgIncidentRepository } from '../repositories/PgIncidentRepository';
import { IncidentService } from '../services/IncidentService';

const router = Router();
const service = new IncidentService(new PgIncidentRepository());

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

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = (req.query.status as string | undefined) || 'active';
    const incidents = await service.list(
      req.userId!,
      status as 'active' | 'all' | 'open' | 'acknowledged' | 'investigating' | 'resolved'
    );
    return res.json(incidents);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const detail = await service.getDetail(paramId(req), req.userId!);
    return res.json(detail);
  } catch (error) {
    return handleError(res, error);
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const detail = await service.update(paramId(req), req.userId!, req.body);
    return res.json(detail);
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:id/acknowledge', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const detail = await service.acknowledge(paramId(req), req.userId!);
    return res.json(detail);
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:id/resolve', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const detail = await service.resolve(paramId(req), req.userId!);
    return res.json(detail);
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:id/comments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const detail = await service.addComment(
      paramId(req),
      req.userId!,
      req.body?.body ?? ''
    );
    return res.status(201).json(detail);
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;
