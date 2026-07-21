import type {
  AlertOperator,
  AlertRule,
  CheckResult,
  MonitorStatus,
} from '@analytic-pulse/shared';
import { query } from '../../../infrastructure/db';
import { logger } from '../../../observability/logger';
import type { CheckableMonitor } from '../../monitoring/checkers';
import type {
  AlertDeliveryRepository,
  AlertRuleRepository,
} from '../repositories/types';
import type { AlertPayload } from './channelDelivery';

function compare(
  left: number,
  operator: AlertOperator,
  right: number
): boolean {
  switch (operator) {
    case '>':
      return left > right;
    case '>=':
      return left >= right;
    case '<':
      return left < right;
    case '<=':
      return left <= right;
    case '==':
      return left === right;
    case '!=':
      return left !== right;
    default:
      return false;
  }
}

export class AlertEvaluator {
  constructor(
    private readonly rules: AlertRuleRepository,
    private readonly deliveries: AlertDeliveryRepository
  ) {}

  async onCheckPersisted(input: {
    monitor: CheckableMonitor & { user_id: string; status: MonitorStatus };
    result: CheckResult;
    statusChanged: boolean;
  }): Promise<{ enqueued: number; usedEngine: boolean }> {
    const enabledCount = await this.rules.countEnabledByUser(
      input.monitor.user_id
    );
    if (enabledCount === 0) {
      return { enqueued: 0, usedEngine: false };
    }

    const rules = await this.rules.listEnabledForMonitor(
      input.monitor.user_id,
      input.monitor.id
    );

    let enqueued = 0;

    for (const rule of rules) {
      const matched = await this.ruleMatches(
        rule,
        input.monitor.id,
        input.result,
        input.statusChanged
      );
      if (!matched) continue;

      const cooldownFingerprint = `${rule.id}:${input.monitor.id}:${rule.metric}:alert`;
      const lastCooldown = await this.deliveries.lastSentAt(cooldownFingerprint);

      if (
        lastCooldown &&
        Date.now() - lastCooldown.getTime() < rule.cooldown_seconds * 1000
      ) {
        logger.debug('Alert suppressed by cooldown', {
          ruleId: rule.id,
          monitorId: input.monitor.id,
        });
        continue;
      }

      const payload: AlertPayload = {
        title: `${input.monitor.name} — ${rule.name}`,
        monitorName: input.monitor.name,
        monitorUrl: input.monitor.url,
        isUp: input.result.is_up,
        statusCode: input.result.status_code,
        errorMessage: input.result.error_message,
        ruleName: rule.name,
        metric: rule.metric,
        severity: rule.severity,
        latencyMs: input.result.response_time_ms,
      };

      const step0 = rule.channels.filter((c) => c.escalation_step === 0);
      const primary = step0.length > 0 ? step0 : rule.channels.slice(0, 1);

      for (const binding of primary) {
        if (binding.channel && !binding.channel.is_enabled) continue;
        await this.deliveries.enqueue({
          ruleId: rule.id,
          channelId: binding.channel_id,
          monitorId: input.monitor.id,
          fingerprint: cooldownFingerprint,
          escalationStep: binding.escalation_step,
          payload: payload as unknown as Record<string, unknown>,
          scheduledAt: new Date(
            Date.now() + (binding.delay_seconds || 0) * 1000
          ),
        });
        enqueued += 1;
      }

      for (const binding of rule.channels.filter((c) => c.escalation_step > 0)) {
        if (binding.channel && !binding.channel.is_enabled) continue;
        await this.deliveries.enqueue({
          ruleId: rule.id,
          channelId: binding.channel_id,
          monitorId: input.monitor.id,
          fingerprint: `${cooldownFingerprint}:esc:${binding.escalation_step}`,
          escalationStep: binding.escalation_step,
          payload: {
            ...(payload as unknown as Record<string, unknown>),
            escalation: true,
            escalation_step: binding.escalation_step,
          },
          scheduledAt: new Date(
            Date.now() + Math.max(binding.delay_seconds, 300) * 1000
          ),
        });
        enqueued += 1;
      }
    }

    return { enqueued, usedEngine: true };
  }

  private async ruleMatches(
    rule: AlertRule,
    monitorId: string,
    result: CheckResult,
    statusChanged: boolean
  ): Promise<boolean> {
    const threshold = rule.threshold ?? 0;

    switch (rule.metric) {
      case 'status_down': {
        if (result.is_up) return false;
        if (rule.for_seconds <= 0) return statusChanged || !result.is_up;
        return this.windowAllDown(monitorId, rule.for_seconds);
      }
      case 'status_up':
        return result.is_up && statusChanged;
      case 'is_up':
        return compare(result.is_up ? 1 : 0, rule.operator, threshold);
      case 'latency_ms': {
        if (rule.for_seconds > 0) {
          return this.windowLatency(
            monitorId,
            rule.operator,
            threshold,
            rule.for_seconds
          );
        }
        return compare(result.response_time_ms, rule.operator, threshold);
      }
      case 'http_status':
        if (result.status_code == null) return false;
        return compare(result.status_code, rule.operator, threshold);
      default:
        return false;
    }
  }

  private async windowAllDown(
    monitorId: string,
    forSeconds: number
  ): Promise<boolean> {
    const result = await query(
      `SELECT is_up, created_at FROM ping_logs
       WHERE monitor_id = $1
         AND created_at >= NOW() - ($2 || ' seconds')::interval
       ORDER BY created_at ASC`,
      [monitorId, String(forSeconds)]
    );
    if (result.rows.length < 2) return false;
    const oldest = new Date(result.rows[0].created_at).getTime();
    if ((Date.now() - oldest) / 1000 < forSeconds * 0.75) return false;
    return result.rows.every((r) => r.is_up === false);
  }

  private async windowLatency(
    monitorId: string,
    operator: AlertOperator,
    threshold: number,
    forSeconds: number
  ): Promise<boolean> {
    const result = await query(
      `SELECT response_time_ms, created_at FROM ping_logs
       WHERE monitor_id = $1
         AND created_at >= NOW() - ($2 || ' seconds')::interval
       ORDER BY created_at ASC`,
      [monitorId, String(forSeconds)]
    );
    if (result.rows.length < 2) return false;
    const oldest = new Date(result.rows[0].created_at).getTime();
    if ((Date.now() - oldest) / 1000 < forSeconds * 0.75) return false;
    return result.rows.every((r) =>
      compare(Number(r.response_time_ms), operator, threshold)
    );
  }
}
