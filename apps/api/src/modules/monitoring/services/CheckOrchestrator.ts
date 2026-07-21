import type { CheckResult, MonitorStatus } from '@analytic-pulse/shared';
import { logger } from '../../../observability/logger';
import {
  inc,
  recordPingResult,
  setLastPingCycleDuration,
} from '../../../observability/metrics';
import { notifyStatusChange } from '../../../services/notificationService';
import { runCheck, runInBatches, type CheckableMonitor } from '../checkers';
import type { MonitorRepository } from '../repositories/MonitorRepository';

export interface PingCycleResult {
  processed: number;
  success: number;
  failed: number;
  elapsed_ms: number;
}

function didStatusChange(previous: MonitorStatus, isUp: boolean): boolean {
  if (previous === 'active') {
    return !isUp;
  }
  if (previous === 'up' || previous === 'down') {
    return (previous === 'up' && !isUp) || (previous === 'down' && isUp);
  }
  return false;
}

export class CheckOrchestrator {
  constructor(private readonly monitors: MonitorRepository) {}

  async runPingCycle(): Promise<PingCycleResult> {
    const startTime = Date.now();
    const log = logger.child({ component: 'CheckOrchestrator' });
    log.info('Ping cycle started');

    const monitors = await this.monitors.findDueForCheck();
    if (monitors.length === 0) {
      return { processed: 0, success: 0, failed: 0, elapsed_ms: 0 };
    }

    log.info('Active monitors loaded', { count: monitors.length });

    const tasks = monitors.map((monitor) => async () => {
      const result = await runCheck(monitor);
      await this.persistCheck(monitor, result);
      return { monitorId: monitor.id, name: monitor.name, ...result };
    });

    const results = await runInBatches(tasks, 5);
    const success = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    const elapsed_ms = Date.now() - startTime;

    inc('ping_cycles_total');
    if (failed > 0) inc('ping_cycle_failures_total', failed);
    setLastPingCycleDuration(elapsed_ms);

    log.info('Ping cycle completed', {
      processed: monitors.length,
      success,
      failed,
      elapsed_ms,
    });

    return {
      processed: monitors.length,
      success,
      failed,
      elapsed_ms,
    };
  }

  private async persistCheck(
    monitor: CheckableMonitor & {
      user_id: string;
      status: MonitorStatus;
    },
    result: CheckResult
  ): Promise<void> {
    try {
      await this.monitors.insertPingLog(monitor.id, result);
    } catch (error) {
      logger.error('Failed to save ping log', {
        monitorId: monitor.id,
        url: monitor.url,
        check_type: result.check_type,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const statusChanged = didStatusChange(monitor.status, result.is_up);
    const newStatus = result.is_up ? 'up' : 'down';

    await this.monitors.updateCheckResult(
      monitor.id,
      newStatus,
      result.response_time_ms
    );

    recordPingResult(result.is_up);

    if (statusChanged) {
      logger.info('Monitor status changed', {
        monitorId: monitor.id,
        name: monitor.name,
        check_type: result.check_type,
        from: monitor.status,
        to: newStatus,
      });
      await notifyStatusChange(
        monitor.user_id,
        monitor.name,
        monitor.url,
        result.is_up,
        result.status_code,
        result.error_message
      );
      inc('notifications_sent_total');
    }
  }
}
