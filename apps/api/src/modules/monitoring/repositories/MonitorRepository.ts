import type {
  CheckResult,
  CreateMonitorInput,
  Monitor,
  MonitorMetrics,
  MonitorStatus,
  PingLog,
  UpdateMonitorInput,
} from '@analytic-pulse/shared';
import type { CheckableMonitor } from '../checkers';

export interface MonitorRepository {
  create(userId: string, input: CreateMonitorInput): Promise<Monitor>;
  findAllByUser(userId: string): Promise<Monitor[]>;
  findByIdForUser(id: string, userId: string): Promise<Monitor | null>;
  update(id: string, userId: string, input: UpdateMonitorInput): Promise<Monitor | null>;
  delete(id: string, userId: string): Promise<boolean>;
  findDueForCheck(): Promise<
    Array<
      CheckableMonitor & {
        user_id: string;
        status: MonitorStatus;
      }
    >
  >;
  updateCheckResult(
    id: string,
    status: Extract<MonitorStatus, 'up' | 'down'>,
    responseTimeMs: number
  ): Promise<void>;
  insertPingLog(monitorId: string, result: CheckResult): Promise<void>;
  getMetrics(monitorId: string): Promise<MonitorMetrics | null>;
  getRecentLogs(monitorId: string, limit?: number): Promise<
    Array<
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
    >
  >;
}
