import { Router, Response, NextFunction } from 'express';
import cors from 'cors';
import {
  isAppError,
  type RumEventInput,
  type RumEventType,
  type RumSite,
} from '@analytic-pulse/shared';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../../../middleware/auth';
import { RumService } from '../services/RumService';
import { inc } from '../../../observability/metrics';

const router = Router();
const service = new RumService();

interface RumTokenRequest extends AuthenticatedRequest {
  rumSite?: RumSite;
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

const ingestCors = cors({
  origin: true,
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Rum-Token'],
  maxAge: 86400,
});

function extractRumToken(req: RumTokenRequest): string {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  const x = req.headers['x-rum-token'];
  if (typeof x === 'string') return x.trim();
  if (Array.isArray(x) && x[0]) return x[0].trim();
  return '';
}

async function requireRumToken(
  req: RumTokenRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const raw = extractRumToken(req);
  if (!raw || !raw.startsWith('ap_rum_')) {
    res.status(401).json({ error: 'Missing or invalid RUM token (ap_rum_…)' });
    return;
  }
  try {
    const site = await service.findByToken(raw);
    if (!site) {
      res.status(401).json({ error: 'Invalid RUM token' });
      return;
    }
    req.userId = site.user_id;
    req.rumSite = site;
    next();
  } catch {
    res.status(401).json({ error: 'RUM token verification failed' });
  }
}

router.options('/ingest', ingestCors);
router.post(
  '/ingest',
  ingestCors,
  requireRumToken as never,
  async (req: RumTokenRequest, res: Response) => {
    try {
      const site = req.rumSite;
      if (!site) {
        return res.status(401).json({ error: 'Invalid RUM token' });
      }
      const body = req.body as { events?: RumEventInput[] };
      const origin =
        typeof req.headers.origin === 'string' ? req.headers.origin : null;
      const ua =
        typeof req.headers['user-agent'] === 'string'
          ? req.headers['user-agent']
          : null;

      const result = await service.ingest(site, body.events || [], {
        userAgent: ua,
        origin,
      });
      inc('rum_events_ingested_total', result.accepted);
      return res.status(202).json({ ok: true, ...result });
    } catch (error) {
      return handleError(res, error);
    }
  }
);

router.get(
  '/overview',
  requireAuth as never,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await service.overview(req.userId!);
      return res.json(data);
    } catch (error) {
      return handleError(res, error);
    }
  }
);

router.get(
  '/sites',
  requireAuth as never,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sites = await service.listSites(req.userId!);
      return res.json({ sites });
    } catch (error) {
      return handleError(res, error);
    }
  }
);

router.post(
  '/sites',
  requireAuth as never,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const created = await service.createSite(req.userId!, req.body || {});
      return res.status(201).json(created);
    } catch (error) {
      return handleError(res, error);
    }
  }
);

router.delete(
  '/sites/:id',
  requireAuth as never,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await service.deleteSite(req.userId!, String(req.params.id));
      return res.status(204).send();
    } catch (error) {
      return handleError(res, error);
    }
  }
);

router.get(
  '/events',
  requireAuth as never,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const siteId =
        typeof req.query.site_id === 'string' ? req.query.site_id : undefined;
      const type =
        typeof req.query.type === 'string'
          ? (req.query.type as RumEventType)
          : undefined;
      const limit =
        typeof req.query.limit === 'string'
          ? Number(req.query.limit)
          : undefined;
      const events = await service.listEvents(req.userId!, {
        siteId,
        type,
        limit,
      });
      return res.json({ events });
    } catch (error) {
      return handleError(res, error);
    }
  }
);

export default router;
