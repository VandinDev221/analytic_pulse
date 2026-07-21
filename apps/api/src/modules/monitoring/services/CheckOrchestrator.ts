import type { CheckResult, MonitorStatus } from '@analytic-pulse/shared';
import { logger } from '../../../observability/logger';
import {
  inc,
  recordPingResult,
  setLastPingCycleDuration,
} from '../../../observability/metrics';
import { notifyStatusChange, notifySslExpiring } from '../../../services/notificationService';
import { AlertDispatcher } from '../../alerts/services/AlertDispatcher';
import { AlertEvaluator } from '../../alerts/services/AlertEvaluator';
import { PgAlertDeliveryRepository } from '../../alerts/repositories/PgAlertDeliveryRepository';
import { PgAlertRuleRepository } from '../../alerts/repositories/PgAlertRepositories';
import { IncidentService } from '../../incidents/services/IncidentService';
import { PgIncidentRepository } from '../../incidents/repositories/PgIncidentRepository';
import { runCheck, runInBatches, type CheckableMonitor } from '../checkers';
import type { MonitorRepository } from '../repositories/MonitorRepository';

export interface PingCycleResult {
  processed: number;
  success: number;
  failed: number;
  elapsed_ms: number;
  alerts_enqueued?: number;
  alerts_sent?: number;
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
  private readonly incidents: IncidentService;
  private readonly alertEvaluator: AlertEvaluator;
  private readonly alertDispatcher: AlertDispatcher;

  constructor(
    private readonly monitors: MonitorRepository,
    deps?: {
      incidents?: IncidentService;
      alertEvaluator?: AlertEvaluator;
      alertDispatcher?: AlertDispatcher;
    }
  ) {
    this.incidents =
      deps?.incidents ?? new IncidentService(new PgIncidentRepository());
    const deliveryRepo = new PgAlertDeliveryRepository();
    this.alertEvaluator =
      deps?.alertEvaluator ??
      new AlertEvaluator(new PgAlertRuleRepository(), deliveryRepo);
    this.alertDispatcher =
      deps?.alertDispatcher ?? new AlertDispatcher(deliveryRepo);
  }

  async runPingCycle(): Promise<PingCycleResult> {
    const startTime = Date.now();
    const log = logger.child({ component: 'CheckOrchestrator' });
    log.info('Ping cycle started');

    const monitors = await this.monitors.findDueForCheck();
    if (monitors.length === 0) {
      const flush = await this.alertDispatcher.processDue();
      return {
        processed: 0,
        success: 0,
        failed: 0,
        elapsed_ms: 0,
        alerts_sent: flush.sent,
      };
    }

    log.info('Active monitors loaded', { count: monitors.length });

    let alertsEnqueued = 0;

    const tasks = monitors.map((monitor) => async () => {
      const result = await runCheck(monitor);
      const enqueued = await this.persistCheck(monitor, result);
      alertsEnqueued += enqueued;
      return { monitorId: monitor.id, name: monitor.name, ...result };
    });

    const results = await runInBatches(tasks, 5);
    const success = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    const flush = await this.alertDispatcher.processDue();
    const elapsed_ms = Date.now() - startTime;

    inc('ping_cycles_total');
    if (failed > 0) inc('ping_cycle_failures_total', failed);
    setLastPingCycleDuration(elapsed_ms);

    log.info('Ping cycle completed', {
      processed: monitors.length,
      success,
      failed,
      elapsed_ms,
      alerts_enqueued: alertsEnqueued,
      alerts_sent: flush.sent,
    });

    return {
      processed: monitors.length,
      success,
      failed,
      elapsed_ms,
      alerts_enqueued: alertsEnqueued,
      alerts_sent: flush.sent,
    };
  }

  private async persistCheck(
    monitor: CheckableMonitor & {
      user_id: string;
      status: MonitorStatus;
      ssl_last_warned_at?: string | null;
    },
    result: CheckResult
  ): Promise<number> {
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
      result.response_time_ms,
      result
    );

    recordPingResult(result.is_up);

    let enqueued = 0;
    let usedEngine = false;

    try {
      const evalResult = await this.alertEvaluator.onCheckPersisted({
        monitor,
        result,
        statusChanged,
      });
      enqueued = evalResult.enqueued;
      usedEngine = evalResult.usedEngine;
    } catch (error) {
      logger.error('Alert evaluation failed', {
        monitorId: monitor.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Aviso automático de renovação SSL (cooldown 24h)
    if (result.check_type === 'ssl' && result.meta?.days_remaining != null) {
      const days = Number(result.meta.days_remaining);
      const warnDays = Number(monitor.ssl_warn_days ?? 30);
      if (Number.isFinite(days) && days >= 0 && days <= warnDays) {
        const lastWarned = monitor.ssl_last_warned_at
          ? new Date(monitor.ssl_last_warned_at).getTime()
          : 0;
        const cooled = Date.now() - lastWarned > 24 * 60 * 60 * 1000;
        if (cooled) {
          try {
            const sent = await notifySslExpiring(
              monitor.user_id,
              monitor.name,
              monitor.url,
              days,
              (result.meta.valid_to as string | null) ?? null
            );
            if (sent) {
              await this.monitors.markSslWarned(monitor.id);
              inc('notifications_sent_total');
            }
          } catch (error) {
            logger.warn('SSL expiry notification failed', {
              monitorId: monitor.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    }

    if (statusChanged) {
      logger.info('Monitor status changed', {
        monitorId: monitor.id,
        name: monitor.name,
        check_type: result.check_type,
        from: monitor.status,
        to: newStatus,
      });

      let alertSent = enqueued > 0;

      // Legacy fallback when no Alert Engine rules exist
      if (!usedEngine) {
        try {
          await notifyStatusChange(
            monitor.user_id,
            monitor.name,
            monitor.url,
            result.is_up,
            result.status_code,
            result.error_message
          );
          alertSent = true;
          inc('notifications_sent_total');
        } catch (error) {
          logger.warn('Legacy notification failed', {
            monitorId: monitor.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      try {
        await this.incidents.handleMonitorStatusChange({
          userId: monitor.user_id,
          monitorId: monitor.id,
          monitorName: monitor.name,
          monitorUrl: monitor.url,
          isUp: result.is_up,
          statusCode: result.status_code,
          errorMessage: result.error_message,
          alertSent,
        });
      } catch (error) {
        logger.error('Incident lifecycle failed', {
          monitorId: monitor.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return enqueued;
  }
}
