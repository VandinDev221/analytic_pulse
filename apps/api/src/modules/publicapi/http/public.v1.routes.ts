import { Router, Response } from 'express';
import { isAppError } from '@analytic-pulse/shared';
import { MonitorService } from '../../monitoring/services/MonitorService';
import { PgMonitorRepository } from '../../monitoring/repositories/PgMonitorRepository';
import { IncidentService } from '../../incidents/services/IncidentService';
import { PgIncidentRepository } from '../../incidents/repositories/PgIncidentRepository';
import { AnalyticsService } from '../../analytics/services/AnalyticsService';
import { SslService } from '../../ssl/services/SslService';
import { DnsService } from '../../dns/services/DnsService';
import { AgentService } from '../../agents/services/AgentService';
import { DockerService } from '../../docker/services/DockerService';
import { KubernetesService } from '../../kubernetes/services/KubernetesService';
import { DashboardService } from '../../dashboard/services/DashboardService';
import { MapService } from '../../map/services/MapService';
import {
  requireApiKey,
  requireScope,
  type ApiKeyRequest,
} from './requireApiKey';

const router = Router();

const monitors = new MonitorService(new PgMonitorRepository());
const incidents = new IncidentService(new PgIncidentRepository());
const analytics = new AnalyticsService();
const ssl = new SslService();
const dns = new DnsService();
const agents = new AgentService();
const docker = new DockerService();
const kubernetes = new KubernetesService();
const dashboard = new DashboardService();
const map = new MapService();

router.use(requireApiKey as never);

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

function paramId(req: ApiKeyRequest): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0]! : id!;
}

// ── Monitors ────────────────────────────────────────────────

router.get(
  '/monitors',
  requireScope('read') as never,
  async (req: ApiKeyRequest, res) => {
    try {
      return res.json(await monitors.list(req.userId!));
    } catch (error) {
      return handleError(res, error);
    }
  }
);

router.get(
  '/monitors/:id',
  requireScope('read') as never,
  async (req: ApiKeyRequest, res) => {
    try {
      return res.json(await monitors.getById(paramId(req), req.userId!));
    } catch (error) {
      return handleError(res, error);
    }
  }
);

router.get(
  '/monitors/:id/metrics',
  requireScope('read') as never,
  async (req: ApiKeyRequest, res) => {
    try {
      return res.json(await monitors.getMetrics(paramId(req), req.userId!));
    } catch (error) {
      return handleError(res, error);
    }
  }
);

router.post(
  '/monitors',
  requireScope('write') as never,
  async (req: ApiKeyRequest, res) => {
    try {
      const monitor = await monitors.create(req.userId!, req.body);
      return res.status(201).json(monitor);
    } catch (error) {
      return handleError(res, error);
    }
  }
);

router.patch(
  '/monitors/:id',
  requireScope('write') as never,
  async (req: ApiKeyRequest, res) => {
    try {
      return res.json(
        await monitors.update(paramId(req), req.userId!, req.body)
      );
    } catch (error) {
      return handleError(res, error);
    }
  }
);

router.delete(
  '/monitors/:id',
  requireScope('write') as never,
  async (req: ApiKeyRequest, res) => {
    try {
      await monitors.remove(paramId(req), req.userId!);
      return res.status(204).send();
    } catch (error) {
      return handleError(res, error);
    }
  }
);

// ── Incidents ───────────────────────────────────────────────

router.get(
  '/incidents',
  requireScope('read') as never,
  async (req: ApiKeyRequest, res) => {
    try {
      const status = (req.query.status as string | undefined) || 'active';
      return res.json(
        await incidents.list(
          req.userId!,
          status as
            | 'active'
            | 'all'
            | 'open'
            | 'acknowledged'
            | 'investigating'
            | 'resolved'
        )
      );
    } catch (error) {
      return handleError(res, error);
    }
  }
);

router.get(
  '/incidents/:id',
  requireScope('read') as never,
  async (req: ApiKeyRequest, res) => {
    try {
      return res.json(await incidents.getDetail(paramId(req), req.userId!));
    } catch (error) {
      return handleError(res, error);
    }
  }
);

// ── Overviews ───────────────────────────────────────────────

router.get(
  '/dashboard/overview',
  requireScope('read') as never,
  async (req: ApiKeyRequest, res) => {
    try {
      return res.json(await dashboard.getOverview(req.userId!));
    } catch (error) {
      return handleError(res, error);
    }
  }
);

router.get(
  '/analytics/overview',
  requireScope('read') as never,
  async (req: ApiKeyRequest, res) => {
    try {
      const range = req.query.range as string | undefined;
      return res.json(await analytics.getOverview(req.userId!, range));
    } catch (error) {
      return handleError(res, error);
    }
  }
);

router.get(
  '/ssl/overview',
  requireScope('read') as never,
  async (req: ApiKeyRequest, res) => {
    try {
      return res.json(await ssl.getOverview(req.userId!));
    } catch (error) {
      return handleError(res, error);
    }
  }
);

router.get(
  '/dns/overview',
  requireScope('read') as never,
  async (req: ApiKeyRequest, res) => {
    try {
      return res.json(await dns.getOverview(req.userId!));
    } catch (error) {
      return handleError(res, error);
    }
  }
);

router.get(
  '/map/overview',
  requireScope('read') as never,
  async (req: ApiKeyRequest, res) => {
    try {
      return res.json(await map.getOverview(req.userId!));
    } catch (error) {
      return handleError(res, error);
    }
  }
);

router.get(
  '/agents',
  requireScope('read') as never,
  async (req: ApiKeyRequest, res) => {
    try {
      return res.json(await agents.list(req.userId!));
    } catch (error) {
      return handleError(res, error);
    }
  }
);

router.get(
  '/agents/:id',
  requireScope('read') as never,
  async (req: ApiKeyRequest, res) => {
    try {
      return res.json(await agents.getById(req.userId!, paramId(req)));
    } catch (error) {
      return handleError(res, error);
    }
  }
);

router.get(
  '/docker/overview',
  requireScope('read') as never,
  async (req: ApiKeyRequest, res) => {
    try {
      return res.json(await docker.getOverview(req.userId!));
    } catch (error) {
      return handleError(res, error);
    }
  }
);

router.get(
  '/kubernetes/overview',
  requireScope('read') as never,
  async (req: ApiKeyRequest, res) => {
    try {
      return res.json(await kubernetes.getOverview(req.userId!));
    } catch (error) {
      return handleError(res, error);
    }
  }
);

export default router;
