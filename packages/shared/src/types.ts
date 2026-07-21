export type MonitorStatus = 'active' | 'inactive' | 'up' | 'down' | 'unknown';

export interface Monitor {
  id: string;
  user_id: string;
  name: string;
  url: string;
  method: string;
  interval_minutes: number;
  status: MonitorStatus;
  created_at: string;
  last_checked_at?: string | null;
  last_response_time_ms?: number | null;
}

export interface CreateMonitorInput {
  name: string;
  url: string;
  method?: string;
  interval_minutes?: number;
}

export interface UpdateMonitorInput {
  name?: string;
  url?: string;
  method?: string;
  interval_minutes?: number;
  status?: MonitorStatus;
}

export interface PingLog {
  id: number;
  monitor_id: string;
  status_code: number | null;
  response_time_ms: number;
  is_up: boolean;
  error_message: string | null;
  created_at: string;
}

export interface PingResult {
  status_code: number | null;
  response_time_ms: number;
  is_up: boolean;
  error_message: string | null;
}

export interface UptimeDay {
  day: string;
  uptime_pct: number;
  total_pings: number;
}

export interface MonitorMetrics {
  avg_response_time_7d: number | null;
  uptime_pct_7d: number | null;
  total_checks_7d: number;
}

export interface MonitorMetricsResponse {
  metrics: MonitorMetrics | null;
  recent_logs: Array<{
    response_time_ms: number;
    is_up: boolean;
    created_at: string;
    status_code: number | null;
    error_message: string | null;
  }>;
}

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

export type NotificationChannel = 'telegram' | 'whatsapp';

export interface NotificationSettings {
  notification_channel: NotificationChannel;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  whatsapp_phone?: string;
  whatsapp_api_key?: string;
  is_enabled: boolean;
}
