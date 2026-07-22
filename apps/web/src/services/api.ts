import type { Monitor, MonitorMetrics, PingLog } from '../types';

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') ||
  'https://analytic-pulse-api.onrender.com';

const API = `${API_BASE}/api`;

function getAuthHeader(): HeadersInit {
  const token = localStorage.getItem('pingpulse_token');
  return token 
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } 
    : { 'Content-Type': 'application/json' };
}

// ── Auth ──────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<{ token: string; user: { id: string; email: string } }> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao entrar');
  }
  const data = await res.json();
  localStorage.setItem('pingpulse_token', data.token);
  return data;
}

export async function sendSignupCode(
  email: string,
  password: string
): Promise<{ message: string; devCode?: string }> {
  const res = await fetch(`${API}/auth/signup/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao enviar código');
  }
  return res.json();
}

export async function verifySignup(
  email: string,
  code: string
): Promise<{ token: string; user: { id: string; email: string } }> {
  const res = await fetch(`${API}/auth/signup/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Código inválido');
  }
  const data = await res.json();
  localStorage.setItem('pingpulse_token', data.token);
  return data;
}

export async function loginWithGoogle(
  credential: string
): Promise<{ token: string; user: { id: string; email: string } }> {
  const res = await fetch(`${API}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao entrar com Google');
  }
  const data = await res.json();
  localStorage.setItem('pingpulse_token', data.token);
  return data;
}

export async function getAuthConfig(): Promise<{ googleEnabled: boolean }> {
  const res = await fetch(`${API}/auth/config`);
  if (!res.ok) return { googleEnabled: false };
  return res.json();
}

/** @deprecated use sendSignupCode + verifySignup */
export async function signup(email: string, password: string): Promise<{ token: string; user: { id: string; email: string } }> {
  await sendSignupCode(email, password);
  throw new Error('Verifique o código enviado ao seu e-mail');
}

export async function getMe(): Promise<{ id: string; email: string; slug: string }> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/auth/me`, { headers });
  if (!res.ok) {
    throw new Error('Não autenticado');
  }
  return res.json();
}

// ── Monitors ──────────────────────────────────────────────────

export async function getMonitors(): Promise<Monitor[]> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/monitors`, { headers });
  if (!res.ok) throw new Error('Failed to fetch monitors');
  return res.json();
}

export async function getDashboardOverview(): Promise<import('../types').DashboardOverview> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/dashboard/overview`, { headers });
  if (!res.ok) throw new Error('Failed to fetch dashboard overview');
  return res.json();
}

export async function getMapOverview(): Promise<import('../types').MapOverview> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/map/overview`, { headers });
  if (!res.ok) throw new Error('Failed to fetch map overview');
  return res.json();
}

export async function getMapRegions(): Promise<import('../types').MapRegion[]> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/map/regions`, { headers });
  if (!res.ok) throw new Error('Failed to fetch map regions');
  return res.json();
}

export async function getAnalyticsOverview(
  range: import('../types').AnalyticsRange = '30d'
): Promise<import('../types').AnalyticsOverview> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/analytics/overview?range=${range}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch analytics');
  return res.json();
}

export async function getSslOverview(): Promise<import('../types').SslOverview> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/ssl/overview`, { headers });
  if (!res.ok) throw new Error('Failed to fetch SSL overview');
  return res.json();
}

export async function getDnsOverview(): Promise<import('../types').DnsOverview> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/dns/overview`, { headers });
  if (!res.ok) throw new Error('Failed to fetch DNS overview');
  return res.json();
}

export async function scanDnsDomain(
  host: string
): Promise<import('../types').DnsDomainScan> {
  const headers = getAuthHeader();
  const res = await fetch(
    `${API}/dns/scan?host=${encodeURIComponent(host)}`,
    { headers }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to scan DNS');
  }
  return res.json();
}

export async function getAgentsOverview(): Promise<import('../types').AgentsOverview> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/agents/overview`, { headers });
  if (!res.ok) throw new Error('Failed to fetch agents');
  return res.json();
}

export async function getAgent(id: string): Promise<import('../types').AgentDetail> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/agents/${id}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch agent');
  return res.json();
}

export async function createAgent(
  name: string
): Promise<import('../types').AgentCreated> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/agents`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create agent');
  }
  return res.json();
}

export async function deleteAgent(id: string): Promise<void> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/agents/${id}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error('Failed to delete agent');
}

export async function getDockerOverview(): Promise<import('../types').DockerOverview> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/docker/overview`, { headers });
  if (!res.ok) throw new Error('Failed to fetch Docker overview');
  return res.json();
}

export async function getKubernetesOverview(): Promise<
  import('../types').KubernetesOverview
> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/kubernetes/overview`, { headers });
  if (!res.ok) throw new Error('Failed to fetch Kubernetes overview');
  return res.json();
}

export function getApiDocsUrl(): string {
  return `${API}/docs`;
}

export async function getApiKeys(): Promise<import('../types').ApiKeysOverview> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/api-keys`, { headers });
  if (!res.ok) throw new Error('Failed to fetch API keys');
  return res.json();
}

export async function createApiKey(
  name: string,
  scopes?: Array<'read' | 'write'>
): Promise<import('../types').ApiKeyCreated> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/api-keys`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name, scopes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create API key');
  }
  return res.json();
}

export async function deleteApiKey(id: string): Promise<void> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/api-keys/${id}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error('Failed to revoke API key');
}

export async function getMonitor(id: string): Promise<Monitor> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/monitors/${id}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch monitor');
  return res.json();
}

export async function createMonitor(payload: Pick<Monitor, 'name' | 'url' | 'method' | 'interval_minutes'>): Promise<Monitor> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/monitors`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create monitor');
  }
  return res.json();
}

export async function updateMonitor(
  id: string,
  payload: Pick<Monitor, 'name' | 'url' | 'method' | 'interval_minutes'>
): Promise<Monitor> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/monitors/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao atualizar monitor');
  }
  return res.json();
}

export async function deleteMonitor(id: string): Promise<void> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/monitors/${id}`, { method: 'DELETE', headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao remover monitor');
  }
}

export async function toggleMonitorStatus(id: string, active: boolean): Promise<Monitor> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/monitors/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: active ? 'active' : 'inactive' }),
  });
  if (!res.ok) throw new Error('Failed to update monitor');
  return res.json();
}

// ── Metrics ───────────────────────────────────────────────────

export async function getMonitorMetrics(id: string): Promise<{
  metrics: MonitorMetrics;
  recent_logs: PingLog[];
}> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/monitors/${id}/metrics`, { headers });
  if (!res.ok) throw new Error('Failed to fetch metrics');
  return res.json();
}

// ── Notification Settings ─────────────────────────────────────

export async function getNotificationSettings(): Promise<import('../types').NotificationSettings> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/monitors/notifications/settings`, { headers });
  if (!res.ok) throw new Error('Failed to fetch notification settings');
  return res.json();
}

export async function saveNotificationSettings(payload: {
  notification_channel: 'telegram' | 'whatsapp';
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  whatsapp_phone?: string;
  whatsapp_api_key?: string;
  is_enabled: boolean;
}) {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/monitors/notifications/settings`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to save settings');
  return res.json();
}

export async function testNotificationSettings(): Promise<void> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/monitors/notifications/test`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao enviar teste');
  }
}

// ── Status Page (public) ──────────────────────────────────────

export async function getStatusPage(slug: string) {
  const res = await fetch(`${API}/status/${slug}`);
  if (!res.ok) throw new Error('Status page not found');
  return res.json();
}

// ── Incidents ─────────────────────────────────────────────────

export async function getIncidents(
  status: 'active' | 'all' | 'open' | 'acknowledged' | 'investigating' | 'resolved' = 'active'
): Promise<import('../types').Incident[]> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/incidents?status=${status}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch incidents');
  return res.json();
}

export async function getIncident(id: string): Promise<import('../types').IncidentDetail> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/incidents/${id}`, { headers });
  if (!res.ok) throw new Error('Incident not found');
  return res.json();
}

export async function updateIncident(
  id: string,
  payload: import('../types').UpdateIncidentInput
): Promise<import('../types').IncidentDetail> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/incidents/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update incident');
  }
  return res.json();
}

export async function acknowledgeIncident(id: string) {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/incidents/${id}/acknowledge`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to acknowledge');
  }
  return res.json();
}

export async function resolveIncident(id: string) {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/incidents/${id}/resolve`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to resolve');
  }
  return res.json();
}

export async function addIncidentComment(id: string, body: string) {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/incidents/${id}/comments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to comment');
  }
  return res.json();
}

// ── Alerts ────────────────────────────────────────────────────

export async function getAlertChannels(): Promise<import('../types').AlertChannel[]> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/alerts/channels`, { headers });
  if (!res.ok) throw new Error('Failed to fetch channels');
  return res.json();
}

export async function createAlertChannel(
  payload: import('../types').CreateAlertChannelInput
) {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/alerts/channels`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create channel');
  }
  return res.json();
}

export async function deleteAlertChannel(id: string): Promise<void> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/alerts/channels/${id}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error('Failed to delete channel');
}

export async function getAlertRules(): Promise<import('../types').AlertRule[]> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/alerts/rules`, { headers });
  if (!res.ok) throw new Error('Failed to fetch rules');
  return res.json();
}

export async function createAlertRule(
  payload: import('../types').CreateAlertRuleInput
) {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/alerts/rules`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create rule');
  }
  return res.json();
}

export async function deleteAlertRule(id: string): Promise<void> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/alerts/rules/${id}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error('Failed to delete rule');
}

export async function getAlertDeliveries(): Promise<import('../types').AlertDelivery[]> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/alerts/deliveries`, { headers });
  if (!res.ok) throw new Error('Failed to fetch deliveries');
  return res.json();
}

export async function subscribeStatusPage(slug: string, email: string) {
  const res = await fetch(`${API}/status/${slug}/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha na inscrição');
  }
  return res.json() as Promise<{ message: string }>;
}

export async function getStatusPageSettings() {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/status-page/settings`, { headers });
  if (!res.ok) throw new Error('Failed to load status page settings');
  return res.json();
}

export async function updateStatusPageSettings(
  payload: import('../types').UpdateStatusPageSettingsInput
) {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/status-page/settings`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save settings');
  }
  return res.json();
}

export async function listMaintenance(): Promise<import('../types').MaintenanceWindow[]> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/status-page/maintenance`, { headers });
  if (!res.ok) throw new Error('Failed to load maintenance');
  return res.json();
}

export async function createMaintenance(
  payload: import('../types').CreateMaintenanceInput
) {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/status-page/maintenance`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create maintenance');
  }
  return res.json();
}

export async function deleteMaintenance(id: string): Promise<void> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/status-page/maintenance/${id}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error('Failed to delete maintenance');
}

// ── AI Assistant ──────────────────────────────────────────────

export type AssistantChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  /** Assinatura HMAC das respostas do assistente (gerada pelo servidor). */
  sig?: string;
};

export async function chatWithAssistant(
  messages: AssistantChatMessage[]
): Promise<AssistantChatMessage> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/ai/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao consultar o assistente');
  }
  const data = await res.json();
  return data.message as AssistantChatMessage;
}

export async function getAiStatus(): Promise<import('../types').AiStatus> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/ai/status`, { headers });
  if (!res.ok) throw new Error('Failed to fetch AI status');
  return res.json();
}

export async function analyzeIncidentWithAi(
  id: string
): Promise<import('../types').IncidentAiAnalysis> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/ai/analyze-incident/${id}`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha na análise de IA');
  }
  return res.json();
}
