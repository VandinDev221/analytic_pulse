import { logger } from '../../../observability/logger';
import { inc } from '../../../observability/metrics';
import { query } from '../../../infrastructure/db';
import { mapChannel, type AlertDeliveryRepository } from '../repositories/types';
import {
  deliverToChannel,
  type AlertPayload,
} from './channelDelivery';
import { realtimeHub } from '../../realtime';

export class AlertDispatcher {
  constructor(private readonly deliveries: AlertDeliveryRepository) {}

  async processDue(limit = 50): Promise<{ sent: number; failed: number }> {
    const due = await this.deliveries.findDue(limit);
    let sent = 0;
    let failed = 0;

    for (const delivery of due) {
      try {
        const channelResult = await query(
          `SELECT * FROM alert_channels WHERE id = $1`,
          [delivery.channel_id]
        );
        const channel = channelResult.rows[0]
          ? mapChannel(channelResult.rows[0])
          : null;

        if (!channel || !channel.is_enabled) {
          await this.deliveries.markSuppressed(
            delivery.id,
            'Channel disabled or missing'
          );
          continue;
        }

        const ruleResult = await query(
          `SELECT name, max_retries, retry_backoff_seconds FROM alert_rules WHERE id = $1`,
          [delivery.rule_id]
        );
        const rule = ruleResult.rows[0] as
          | {
              name: string;
              max_retries: number;
              retry_backoff_seconds: number;
            }
          | undefined;

        const payload = delivery.payload as unknown as AlertPayload;
        await deliverToChannel(channel, payload);
        await this.deliveries.markSent(delivery.id);
        sent += 1;
        inc('notifications_sent_total');
        realtimeHub.publish(channel.user_id, {
          type: 'alert.delivered',
          payload: {
            delivery_id: delivery.id,
            channel_id: channel.id,
            channel_kind: channel.kind,
            rule: rule?.name,
            monitor_id: delivery.monitor_id,
          },
        });
        logger.info('Alert delivered', {
          deliveryId: delivery.id,
          channel: channel.kind,
          rule: rule?.name,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Delivery failed';

        const ruleResult = await query(
          `SELECT max_retries, retry_backoff_seconds FROM alert_rules WHERE id = $1`,
          [delivery.rule_id]
        );
        const rule = ruleResult.rows[0] as
          | { max_retries: number; retry_backoff_seconds: number }
          | undefined;

        const maxRetries = Number(rule?.max_retries ?? 3);
        const backoff = Number(rule?.retry_backoff_seconds ?? 60);
        const nextAttempt = delivery.attempt + 1;

        if (nextAttempt < maxRetries) {
          const delay = backoff * Math.pow(2, delivery.attempt) * 1000;
          await this.deliveries.markFailed(
            delivery.id,
            message,
            new Date(Date.now() + delay)
          );
          logger.warn('Alert delivery retry scheduled', {
            deliveryId: delivery.id,
            attempt: nextAttempt,
            delay_ms: delay,
            error: message,
          });
        } else {
          await this.deliveries.markFailed(delivery.id, message, null);
          failed += 1;
          logger.error('Alert delivery failed permanently', {
            deliveryId: delivery.id,
            error: message,
          });
        }
      }
    }

    return { sent, failed };
  }
}
