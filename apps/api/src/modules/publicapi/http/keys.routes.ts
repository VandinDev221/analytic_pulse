import { Router, Response } from 'express';
import { isAppError } from '@analytic-pulse/shared';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../../../middleware/auth';
import { ApiKeyService } from '../services/ApiKeyService';

const router = Router();
const service = new ApiKeyService();

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

router.get('/', async (req: AuthenticatedRequest, res) => {
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

router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    await service.revoke(req.userId!, paramId(req));
    return res.status(204).send();
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;
