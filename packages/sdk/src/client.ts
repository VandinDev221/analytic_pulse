import type {
  AgentDetail,
  AgentsOverview,
  AnalyticsOverview,
  CreateMonitorInput,
  DashboardOverview,
  DnsOverview,
  DockerOverview,
  Incident,
  IncidentDetail,
  IncidentStatus,
  KubernetesOverview,
  MapOverview,
  Monitor,
  MonitorMetricsResponse,
  SslOverview,
  UpdateMonitorInput,
} from '@analytic-pulse/shared';
import { PulseApiError } from './errors';

export type PulseClientOptions = {
  /** Base URL da API, ex: https://api.example.com (sem /api/v1) */
  baseUrl: string;
  /** Token ap_pk_… */
  apiKey: string;
  /** Timeout em ms (default 30000) */
  timeoutMs?: number;
  fetch?: typeof fetch;
};

type IncidentListStatus =
  | IncidentStatus
  | 'active'
  | 'all';

export class PulseClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: PulseClientOptions) {
    if (!options.baseUrl?.trim()) {
      throw new Error('baseUrl is required');
    }
    if (!options.apiKey?.trim()) {
      throw new Error('apiKey is required');
    }
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey.trim();
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.fetchImpl = options.fetch ?? fetch;
  }

  // ── Monitors ──────────────────────────────────────────────

  listMonitors(): Promise<Monitor[]> {
    return this.request<Monitor[]>('GET', '/monitors');
  }

  getMonitor(id: string): Promise<Monitor> {
    return this.request<Monitor>('GET', `/monitors/${id}`);
  }

  getMonitorMetrics(id: string): Promise<MonitorMetricsResponse> {
    return this.request<MonitorMetricsResponse>('GET', `/monitors/${id}/metrics`);
  }

  createMonitor(input: CreateMonitorInput): Promise<Monitor> {
    return this.request<Monitor>('POST', '/monitors', input);
  }

  updateMonitor(id: string, input: UpdateMonitorInput): Promise<Monitor> {
    return this.request<Monitor>('PATCH', `/monitors/${id}`, input);
  }

  deleteMonitor(id: string): Promise<void> {
    return this.request<void>('DELETE', `/monitors/${id}`);
  }

  // ── Incidents ─────────────────────────────────────────────

  listIncidents(status: IncidentListStatus = 'active'): Promise<Incident[]> {
    const q = new URLSearchParams({ status });
    return this.request<Incident[]>('GET', `/incidents?${q}`);
  }

  getIncident(id: string): Promise<IncidentDetail> {
    return this.request<IncidentDetail>('GET', `/incidents/${id}`);
  }

  // ── Overviews ─────────────────────────────────────────────

  getDashboardOverview(): Promise<DashboardOverview> {
    return this.request<DashboardOverview>('GET', '/dashboard/overview');
  }

  getAnalyticsOverview(range?: string): Promise<AnalyticsOverview> {
    const q = range ? `?range=${encodeURIComponent(range)}` : '';
    return this.request<AnalyticsOverview>('GET', `/analytics/overview${q}`);
  }

  getSslOverview(): Promise<SslOverview> {
    return this.request<SslOverview>('GET', '/ssl/overview');
  }

  getDnsOverview(): Promise<DnsOverview> {
    return this.request<DnsOverview>('GET', '/dns/overview');
  }

  getMapOverview(): Promise<MapOverview> {
    return this.request<MapOverview>('GET', '/map/overview');
  }

  getDockerOverview(): Promise<DockerOverview> {
    return this.request<DockerOverview>('GET', '/docker/overview');
  }

  getKubernetesOverview(): Promise<KubernetesOverview> {
    return this.request<KubernetesOverview>('GET', '/kubernetes/overview');
  }

  // ── Agents ────────────────────────────────────────────────

  listAgents(): Promise<AgentsOverview> {
    return this.request<AgentsOverview>('GET', '/agents');
  }

  getAgent(id: string): Promise<AgentDetail> {
    return this.request<AgentDetail>('GET', `/agents/${id}`);
  }

  // ── HTTP ──────────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path.startsWith('/') ? path : `/${path}`}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (res.status === 204) {
        return undefined as T;
      }

      const text = await res.text();
      let data: unknown = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      if (!res.ok) {
        const errObj = data as { error?: string; code?: string } | null;
        throw new PulseApiError(
          errObj?.error || `HTTP ${res.status}`,
          res.status,
          errObj?.code,
          data
        );
      }

      return data as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
