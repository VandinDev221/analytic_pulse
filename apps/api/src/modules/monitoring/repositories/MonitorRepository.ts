import type {
  CreateMonitorInput,
  Monitor,
  MonitorMetrics,
  MonitorStatus,
  PingLog,
  UpdateMonitorInput,
} from '@analytic-pulse/shared';

export interface MonitorRepository {
  create(userId: string, input: CreateMonitorInput): Promise<Monitor>;
  findAllByUser(userId: string): Promise<Monitor[]>;
  findByIdForUser(id: string, userId: string): Promise<Monitor | null>;
  update(id: string, userId: string, input: UpdateMonitorInput): Promise<Monitor | null>;
  delete(id: string, userId: string): Promise<boolean>;
  findDueForCheck(): Promise<Array<Pick<Monitor, 'id' | 'user_id' | 'name' | 'url' | 'status'>>>;
  updateCheckResult(
    id: string,
    status: Extract<MonitorStatus, 'up' | 'down'>,
    responseTimeMs: number
  ): Promise<void>;
  insertPingLog(
    monitorId: string,
    log: {
      status_code: number | null;
      response_time_ms: number;
      is_up: boolean;
      error_message: string | null;
    }
  ): Promise<void>;
  getMetrics(monitorId: string): Promise<MonitorMetrics | null>;
  getRecentLogs(monitorId: string, limit?: number): Promise<
    Array<Pick<PingLog, 'response_time_ms' | 'is_up' | 'created_at' | 'status_code' | 'error_message'>>
  >;
}
