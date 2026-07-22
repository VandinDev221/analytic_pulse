import type {
  AgentStatus,
  KubernetesOverview,
  KubernetesSnapshot,
} from '@analytic-pulse/shared';
import { query } from '../../../infrastructure/db';

const OFFLINE_AFTER_MS = 120_000;

function resolveStatus(row: Record<string, unknown>): AgentStatus {
  const stored = (row.status as AgentStatus) || 'pending';
  if (stored === 'disabled') return 'disabled';
  const lastSeen = row.last_seen_at
    ? new Date(row.last_seen_at as Date | string).getTime()
    : null;
  if (lastSeen == null) return 'pending';
  return Date.now() - lastSeen > OFFLINE_AFTER_MS ? 'offline' : 'online';
}

function extractKubernetes(agent: {
  latest_metrics: Record<string, unknown>;
}): KubernetesSnapshot {
  const metrics = agent.latest_metrics || {};
  const k8s = metrics.kubernetes as KubernetesSnapshot | undefined;
  if (k8s && typeof k8s === 'object') {
    return {
      available: Boolean(k8s.available),
      context: k8s.context ?? null,
      pods: Array.isArray(k8s.pods) ? k8s.pods : [],
      deployments: Array.isArray(k8s.deployments) ? k8s.deployments : [],
      services: Array.isArray(k8s.services) ? k8s.services : [],
      ingresses: Array.isArray(k8s.ingresses) ? k8s.ingresses : [],
      nodes: Array.isArray(k8s.nodes) ? k8s.nodes : [],
      namespaces: Array.isArray(k8s.namespaces) ? k8s.namespaces : [],
      pvcs: Array.isArray(k8s.pvcs) ? k8s.pvcs : [],
    };
  }
  return {
    available: false,
    context: null,
    pods: [],
    deployments: [],
    services: [],
    ingresses: [],
    nodes: [],
    namespaces: [],
    pvcs: [],
  };
}

function isPodRunning(status: string): boolean {
  return status.toLowerCase() === 'running';
}

export class KubernetesService {
  async getOverview(userId: string): Promise<KubernetesOverview> {
    const result = await query(
      `SELECT id, name, hostname, status, latest_metrics, last_seen_at
       FROM agents
       WHERE user_id = $1 AND status != 'disabled'
       ORDER BY COALESCE(last_seen_at, created_at) DESC`,
      [userId]
    );

    const hosts: KubernetesOverview['hosts'] = [];
    const pods: KubernetesOverview['pods'] = [];
    const deployments: KubernetesOverview['deployments'] = [];
    const services: KubernetesOverview['services'] = [];
    const ingresses: KubernetesOverview['ingresses'] = [];
    const nodes: KubernetesOverview['nodes'] = [];
    const namespaces: KubernetesOverview['namespaces'] = [];
    const pvcs: KubernetesOverview['pvcs'] = [];

    for (const row of result.rows as Array<Record<string, unknown>>) {
      const status = resolveStatus(row);
      const k8s = extractKubernetes({
        latest_metrics: (row.latest_metrics as Record<string, unknown>) || {},
      });
      const running = k8s.pods.filter((p) => isPodRunning(p.status)).length;

      hosts.push({
        agent_id: String(row.id),
        agent_name: String(row.name),
        hostname: (row.hostname as string | null) ?? null,
        status,
        available: k8s.available,
        context: k8s.context ?? null,
        pods_total: k8s.pods.length,
        pods_running: running,
        deployments: k8s.deployments.length,
        services: k8s.services.length,
        nodes: k8s.nodes.length,
        namespaces: k8s.namespaces.length,
        last_seen_at: row.last_seen_at
          ? new Date(row.last_seen_at as Date | string).toISOString()
          : null,
      });

      const meta = {
        agent_id: String(row.id),
        agent_name: String(row.name),
      };

      for (const p of k8s.pods) pods.push({ ...p, ...meta });
      for (const d of k8s.deployments) deployments.push({ ...d, ...meta });
      for (const s of k8s.services) services.push({ ...s, ...meta });
      for (const i of k8s.ingresses) ingresses.push({ ...i, ...meta });
      for (const n of k8s.nodes) nodes.push({ ...n, ...meta });
      for (const ns of k8s.namespaces) namespaces.push({ ...ns, ...meta });
      for (const pvc of k8s.pvcs) pvcs.push({ ...pvc, ...meta });
    }

    return {
      summary: {
        hosts: hosts.length,
        hosts_with_k8s: hosts.filter((h) => h.available).length,
        pods_total: pods.length,
        pods_running: pods.filter((p) => isPodRunning(p.status)).length,
        deployments_total: deployments.length,
        services_total: services.length,
        nodes_total: nodes.length,
        namespaces_total: namespaces.length,
        ingresses_total: ingresses.length,
        pvcs_total: pvcs.length,
      },
      hosts,
      pods,
      deployments,
      services,
      ingresses,
      nodes,
      namespaces,
      pvcs,
    };
  }
}
