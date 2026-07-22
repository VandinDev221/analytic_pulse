import type {
  AgentStatus,
  DockerOverview,
  DockerSnapshot,
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

function extractDocker(agent: {
  latest_metrics: Record<string, unknown>;
}): DockerSnapshot {
  const metrics = agent.latest_metrics || {};
  const docker = metrics.docker as DockerSnapshot | undefined;
  if (docker && typeof docker === 'object') {
    return {
      available: Boolean(docker.available),
      containers: Array.isArray(docker.containers) ? docker.containers : [],
      volumes: Array.isArray(docker.volumes) ? docker.volumes : [],
      networks: Array.isArray(docker.networks) ? docker.networks : [],
      logs: Array.isArray(docker.logs) ? docker.logs : [],
    };
  }

  const containers = Array.isArray(metrics.containers)
    ? (metrics.containers as DockerSnapshot['containers'])
    : [];
  return {
    available: containers.length > 0,
    containers,
    volumes: [],
    networks: [],
    logs: [],
  };
}

export class DockerService {
  async getOverview(userId: string): Promise<DockerOverview> {
    const result = await query(
      `SELECT id, name, hostname, status, latest_metrics, last_seen_at
       FROM agents
       WHERE user_id = $1 AND status != 'disabled'
       ORDER BY COALESCE(last_seen_at, created_at) DESC`,
      [userId]
    );

    const hosts: DockerOverview['hosts'] = [];
    const containers: DockerOverview['containers'] = [];
    const volumes: DockerOverview['volumes'] = [];
    const networks: DockerOverview['networks'] = [];
    const logs: DockerOverview['logs'] = [];

    for (const row of result.rows as Array<Record<string, unknown>>) {
      const status = resolveStatus(row);
      const docker = extractDocker({
        latest_metrics: (row.latest_metrics as Record<string, unknown>) || {},
      });
      const running = docker.containers.filter((c) =>
        (c.state || c.status || '').toLowerCase().includes('running')
      ).length;
      const stopped = docker.containers.length - running;

      hosts.push({
        agent_id: String(row.id),
        agent_name: String(row.name),
        hostname: (row.hostname as string | null) ?? null,
        status,
        available: docker.available,
        containers_total: docker.containers.length,
        containers_running: running,
        containers_stopped: Math.max(0, stopped),
        volumes: docker.volumes.length,
        networks: docker.networks.length,
        last_seen_at: row.last_seen_at
          ? new Date(row.last_seen_at as Date | string).toISOString()
          : null,
      });

      for (const c of docker.containers) {
        containers.push({
          ...c,
          agent_id: String(row.id),
          agent_name: String(row.name),
          hostname: (row.hostname as string | null) ?? null,
        });
      }
      for (const v of docker.volumes) {
        volumes.push({
          ...v,
          agent_id: String(row.id),
          agent_name: String(row.name),
        });
      }
      for (const n of docker.networks) {
        networks.push({
          ...n,
          agent_id: String(row.id),
          agent_name: String(row.name),
        });
      }
      for (const l of docker.logs) {
        logs.push({
          ...l,
          agent_id: String(row.id),
          agent_name: String(row.name),
        });
      }
    }

    return {
      summary: {
        hosts: hosts.length,
        hosts_with_docker: hosts.filter((h) => h.available).length,
        containers_total: containers.length,
        containers_running: containers.filter((c) =>
          (c.state || c.status || '').toLowerCase().includes('running')
        ).length,
        volumes_total: volumes.length,
        networks_total: networks.length,
      },
      hosts,
      containers,
      volumes,
      networks,
      logs,
    };
  }
}
