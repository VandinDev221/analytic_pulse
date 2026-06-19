// ── Monitor ──────────────────────────────────────────────────
export interface Monitor {
  id: string;
  user_id: string;
  name: string;
  url: string;
  method: string;
  interval_minutes: number;
  status: 'active' | 'inactive' | 'up' | 'down' | 'unknown';
  created_at: string;
  last_checked_at?: string;
  last_response_time_ms?: number;
}

// ── Ping Log ─────────────────────────────────────────────────
export interface PingLog {
  id: number;
  monitor_id: string;
  status_code: number | null;
  response_time_ms: number;
  is_up: boolean;
  error_message: string | null;
  created_at: string;
}

// ── Uptime Grid ───────────────────────────────────────────────
export interface UptimeDay {
  day: string;          // ISO date string YYYY-MM-DD
  uptime_pct: number;   // 0–100
  total_pings: number;
}

// ── Metrics ───────────────────────────────────────────────────
export interface MonitorMetrics {
  avg_response_time_7d: number | null;
  uptime_pct_7d: number | null;
  total_checks_7d: number;
}

// ── Status Page ───────────────────────────────────────────────
export interface StatusPageProfile {
  display_name: string;
  page_title: string;
  page_description: string;
}

export interface StatusPageMonitor extends Monitor {
  uptime_90d: string | null;
}

export interface StatusPageData {
  profile: StatusPageProfile;
  monitors: StatusPageMonitor[];
  uptime_grids: Record<string, UptimeDay[]>;
}

// ── Notification Settings ─────────────────────────────────────
export interface NotificationSettings {
  id: string;
  telegram_chat_id: string;
  is_enabled: boolean;
}
