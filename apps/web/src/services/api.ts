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
