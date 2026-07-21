export type MonitorStatus = 'active' | 'inactive' | 'up' | 'down' | 'unknown';

/** Tipos de verificação suportados (Fase 1) */
export type CheckType =
  | 'http'
  | 'https'
  | 'tcp'
  | 'port'
  | 'ping'
  | 'dns'
  | 'ssl';

export type DnsRecordType =
  | 'A'
  | 'AAAA'
  | 'MX'
  | 'TXT'
  | 'CNAME'
  | 'NS'
  | 'SPF'
  | 'DKIM'
  | 'DMARC'
  | 'DNSSEC';

export const CHECK_TYPES: CheckType[] = [
  'http',
  'https',
  'tcp',
  'port',
  'ping',
  'dns',
  'ssl',
];

export interface Monitor {
  id: string;
  user_id: string;
  name: string;
  url: string;
  method: string;
  interval_minutes: number;
  status: MonitorStatus;
  check_type: CheckType;
  host?: string | null;
  port?: number | null;
  dns_record_type?: DnsRecordType | null;
  keyword?: string | null;
  expected_status_codes?: number[] | null;
  expected_header_name?: string | null;
  expected_header_value?: string | null;
  json_path?: string | null;
  json_expected?: string | null;
  request_headers?: Record<string, string> | null;
  request_body?: string | null;
  created_at: string;
  last_checked_at?: string | null;
  last_response_time_ms?: number | null;
}

export interface CreateMonitorInput {
  name: string;
  url: string;
  method?: string;
  interval_minutes?: number;
  check_type?: CheckType;
  host?: string;
  port?: number;
  dns_record_type?: DnsRecordType;
  keyword?: string;
  expected_status_codes?: number[];
  expected_header_name?: string;
  expected_header_value?: string;
  json_path?: string;
  json_expected?: string;
  request_headers?: Record<string, string>;
  request_body?: string;
}

export interface UpdateMonitorInput {
  name?: string;
  url?: string;
  method?: string;
  interval_minutes?: number;
  status?: MonitorStatus;
  check_type?: CheckType;
  host?: string | null;
  port?: number | null;
  dns_record_type?: DnsRecordType | null;
  keyword?: string | null;
  expected_status_codes?: number[] | null;
  expected_header_name?: string | null;
  expected_header_value?: string | null;
  json_path?: string | null;
  json_expected?: string | null;
  request_headers?: Record<string, string> | null;
  request_body?: string | null;
}

export interface TimingBreakdown {
  dns_ms: number | null;
  tcp_ms: number | null;
  tls_ms: number | null;
  ttfb_ms: number | null;
  download_ms: number | null;
  total_ms: number;
}

export interface PingLog {
  id: number;
  monitor_id: string;
  status_code: number | null;
  response_time_ms: number;
  is_up: boolean;
  error_message: string | null;
  created_at: string;
  check_type?: CheckType | null;
  dns_ms?: number | null;
  tcp_ms?: number | null;
  tls_ms?: number | null;
  ttfb_ms?: number | null;
  download_ms?: number | null;
  response_size_bytes?: number | null;
  content_length?: number | null;
  response_headers?: Record<string, string> | null;
  redirect_chain?: string[] | null;
}

export interface CheckResult {
  status_code: number | null;
  response_time_ms: number;
  is_up: boolean;
  error_message: string | null;
  check_type: CheckType;
  timings: TimingBreakdown;
  response_size_bytes: number | null;
  content_length: number | null;
  response_headers: Record<string, string> | null;
  redirect_chain: string[] | null;
  /** Detalhe opcional (ex.: registros DNS, issuer SSL) */
  meta?: Record<string, unknown>;
}

/** @deprecated use CheckResult — mantido para compat */
export type PingResult = CheckResult;

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
  recent_logs: Array<
    Pick<
      PingLog,
      | 'response_time_ms'
      | 'is_up'
      | 'created_at'
      | 'status_code'
      | 'error_message'
      | 'check_type'
      | 'dns_ms'
      | 'tcp_ms'
      | 'tls_ms'
      | 'ttfb_ms'
      | 'download_ms'
      | 'response_size_bytes'
      | 'content_length'
      | 'redirect_chain'
    >
  >;
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

// ── Incidents (Fase 2) ────────────────────────────────────────

export type IncidentStatus =
  | 'open'
  | 'acknowledged'
  | 'investigating'
  | 'resolved';

export type IncidentSeverity =
  | 'critical'
  | 'high'
  | 'major'
  | 'minor'
  | 'low';

export type IncidentTimelineEventType =
  | 'monitor_down'
  | 'monitor_up'
  | 'alert_sent'
  | 'incident_opened'
  | 'incident_acknowledged'
  | 'incident_investigating'
  | 'incident_resolved'
  | 'comment_added'
  | 'note_updated'
  | 'severity_changed'
  | 'root_cause_updated'
  | 'system';

export interface AffectedMonitor {
  id: string;
  name: string;
  url: string;
  status: MonitorStatus;
  check_type?: CheckType;
}

export interface Incident {
  id: string;
  user_id: string;
  title: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  root_cause: string | null;
  notes: string | null;
  tags: string[];
  opened_at: string;
  acknowledged_at: string | null;
  recovered_at: string | null;
  resolved_at: string | null;
  acknowledged_by: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
  /** Duração em ms (até recovered_at ou now se aberto) */
  duration_ms: number;
  affected_monitors: AffectedMonitor[];
}

export interface IncidentTimelineEvent {
  id: string;
  incident_id: string;
  event_type: IncidentTimelineEventType;
  message: string;
  actor_user_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface IncidentComment {
  id: string;
  incident_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author_email?: string | null;
}

export interface IncidentDetail extends Incident {
  timeline: IncidentTimelineEvent[];
  comments: IncidentComment[];
}

export interface UpdateIncidentInput {
  title?: string;
  severity?: IncidentSeverity;
  root_cause?: string | null;
  notes?: string | null;
  tags?: string[];
  status?: IncidentStatus;
}

export interface CreateIncidentCommentInput {
  body: string;
}

// ── Alerts (Fase 3) ───────────────────────────────────────────

export type AlertChannelKind =
  | 'telegram'
  | 'whatsapp'
  | 'email'
  | 'slack'
  | 'webhook'
  | 'discord'
  | 'teams';

export type AlertMetric =
  | 'status_down'
  | 'status_up'
  | 'latency_ms'
  | 'http_status'
  | 'is_up';

export type AlertOperator = '>' | '>=' | '<' | '<=' | '==' | '!=';

export type AlertDeliveryStatus =
  | 'pending'
  | 'sent'
  | 'failed'
  | 'suppressed';

export interface AlertChannel {
  id: string;
  user_id: string;
  name: string;
  kind: AlertChannelKind;
  config: Record<string, unknown>;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AlertRuleChannelBinding {
  channel_id: string;
  escalation_step: number;
  delay_seconds: number;
  channel?: AlertChannel;
}

export interface AlertRule {
  id: string;
  user_id: string;
  name: string;
  is_enabled: boolean;
  monitor_id: string | null;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number | null;
  for_seconds: number;
  severity: IncidentSeverity;
  cooldown_seconds: number;
  max_retries: number;
  retry_backoff_seconds: number;
  priority: number;
  created_at: string;
  updated_at: string;
  channels: AlertRuleChannelBinding[];
}

export interface CreateAlertChannelInput {
  name: string;
  kind: AlertChannelKind;
  config: Record<string, unknown>;
  is_enabled?: boolean;
}

export interface UpdateAlertChannelInput {
  name?: string;
  kind?: AlertChannelKind;
  config?: Record<string, unknown>;
  is_enabled?: boolean;
}

export interface CreateAlertRuleInput {
  name: string;
  is_enabled?: boolean;
  monitor_id?: string | null;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold?: number | null;
  for_seconds?: number;
  severity?: IncidentSeverity;
  cooldown_seconds?: number;
  max_retries?: number;
  retry_backoff_seconds?: number;
  priority?: number;
  channels: Array<{
    channel_id: string;
    escalation_step?: number;
    delay_seconds?: number;
  }>;
}

export interface UpdateAlertRuleInput {
  name?: string;
  is_enabled?: boolean;
  monitor_id?: string | null;
  metric?: AlertMetric;
  operator?: AlertOperator;
  threshold?: number | null;
  for_seconds?: number;
  severity?: IncidentSeverity;
  cooldown_seconds?: number;
  max_retries?: number;
  retry_backoff_seconds?: number;
  priority?: number;
  channels?: Array<{
    channel_id: string;
    escalation_step?: number;
    delay_seconds?: number;
  }>;
}

export interface AlertDelivery {
  id: string;
  rule_id: string;
  channel_id: string;
  monitor_id: string | null;
  incident_id: string | null;
  fingerprint: string;
  status: AlertDeliveryStatus;
  attempt: number;
  escalation_step: number;
  payload: Record<string, unknown>;
  last_error: string | null;
  scheduled_at: string;
  fired_at: string | null;
  created_at: string;
}
