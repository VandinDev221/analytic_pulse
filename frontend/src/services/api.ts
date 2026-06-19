import { supabase } from '../lib/supabase';
import type { Monitor, MonitorMetrics, PingLog } from '../types';

const API = '/api';

async function getAuthHeader(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

// ── Monitors ──────────────────────────────────────────────────

export async function getMonitors(): Promise<Monitor[]> {
  const headers = await getAuthHeader();
  const res = await fetch(`${API}/monitors`, { headers });
  if (!res.ok) throw new Error('Failed to fetch monitors');
  return res.json();
}

export async function createMonitor(payload: Pick<Monitor, 'name' | 'url' | 'method' | 'interval_minutes'>): Promise<Monitor> {
  const headers = await getAuthHeader();
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
  const headers = await getAuthHeader();
  const res = await fetch(`${API}/monitors/${id}`, { method: 'DELETE', headers });
  if (!res.ok) throw new Error('Failed to delete monitor');
}

export async function toggleMonitorStatus(id: string, active: boolean): Promise<Monitor> {
  const headers = await getAuthHeader();
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
  const headers = await getAuthHeader();
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
  const headers = await getAuthHeader();
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
