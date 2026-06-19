import type { Monitor, MonitorMetrics, PingLog } from '../types';

function resolveApiBase(): string {
  if (import.meta.env.VITE_API_URL) {
    return `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`;
  }
  // Fallback: build sem VITE_API_URL chama o static site e retorna 405 no POST
  if (import.meta.env.PROD && typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'analytic-pulse-web.onrender.com' || host.endsWith('.onrender.com')) {
      return 'https://analytic-pulse-api.onrender.com/api';
    }
  }
  return '/api';
}

const API = resolveApiBase();

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

export async function signup(email: string, password: string): Promise<{ token: string; user: { id: string; email: string } }> {
  const res = await fetch(`${API}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao cadastrar');
  }
  const data = await res.json();
  localStorage.setItem('pingpulse_token', data.token);
  return data;
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

export async function deleteMonitor(id: string): Promise<void> {
  const headers = getAuthHeader();
  const res = await fetch(`${API}/monitors/${id}`, { method: 'DELETE', headers });
  if (!res.ok) throw new Error('Failed to delete monitor');
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

export async function saveNotificationSettings(payload: {
  telegram_bot_token: string;
  telegram_chat_id: string;
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

// ── Status Page (public) ──────────────────────────────────────

export async function getStatusPage(slug: string) {
  const res = await fetch(`${API}/status/${slug}`);
  if (!res.ok) throw new Error('Status page not found');
  return res.json();
}
