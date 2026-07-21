import { Router, Request, Response } from 'express';
import { isAppError } from '@analytic-pulse/shared';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../../../middleware/auth';
import { StatusPageService } from '../services/StatusPageService';

const router = Router();
const service = new StatusPageService();

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

function paramSlug(req: Request): string {
  const slug = req.params.slug;
  return Array.isArray(slug) ? slug[0]! : slug!;
}

/** Público — rotas mais específicas antes de /:slug */
router.get('/:slug/rss.xml', async (req, res) => {
  try {
    const xml = await service.buildRss(paramSlug(req));
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    return res.send(xml);
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:slug/subscribe', async (req, res) => {
  try {
    const result = await service.subscribe(paramSlug(req), req.body?.email ?? '');
    return res.status(201).json(result);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const page = await service.getPublicPage(paramSlug(req));
    return res.json(page);
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;

/** Rotas autenticadas montadas em /api/status-page */
export const statusPageAdminRouter = Router();
statusPageAdminRouter.use(requireAuth as never);

statusPageAdminRouter.get('/settings', async (req: AuthenticatedRequest, res) => {
  try {
    return res.json(await service.getSettings(req.userId!));
  } catch (error) {
    return handleError(res, error);
  }
});

statusPageAdminRouter.put('/settings', async (req: AuthenticatedRequest, res) => {
  try {
    return res.json(await service.updateSettings(req.userId!, req.body));
  } catch (error) {
    return handleError(res, error);
  }
});

statusPageAdminRouter.get('/maintenance', async (req: AuthenticatedRequest, res) => {
  try {
    return res.json(await service.listMaintenance(req.userId!));
  } catch (error) {
    return handleError(res, error);
  }
});

statusPageAdminRouter.post('/maintenance', async (req: AuthenticatedRequest, res) => {
  try {
    const item = await service.createMaintenance(req.userId!, req.body);
    return res.status(201).json(item);
  } catch (error) {
    return handleError(res, error);
  }
});

statusPageAdminRouter.delete('/maintenance/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
    await service.deleteMaintenance(id, req.userId!);
    return res.status(204).send();
  } catch (error) {
    return handleError(res, error);
  }
});
