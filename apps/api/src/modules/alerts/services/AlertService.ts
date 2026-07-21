import {
  NotFoundError,
  ValidationError,
  type AlertChannel,
  type AlertDelivery,
  type AlertRule,
  type CreateAlertChannelInput,
  type CreateAlertRuleInput,
  type UpdateAlertChannelInput,
  type UpdateAlertRuleInput,
} from '@analytic-pulse/shared';
import type {
  AlertChannelRepository,
  AlertDeliveryRepository,
  AlertRuleRepository,
} from '../repositories/types';

const CHANNEL_KINDS = [
  'telegram',
  'whatsapp',
  'email',
  'slack',
  'webhook',
  'discord',
  'teams',
] as const;

export class AlertService {
  constructor(
    private readonly channels: AlertChannelRepository,
    private readonly rules: AlertRuleRepository,
    private readonly deliveries: AlertDeliveryRepository
  ) {}

  listChannels(userId: string): Promise<AlertChannel[]> {
    return this.channels.listByUser(userId);
  }

  async createChannel(
    userId: string,
    input: CreateAlertChannelInput
  ): Promise<AlertChannel> {
    if (!input.name?.trim()) throw new ValidationError('name is required');
    if (!CHANNEL_KINDS.includes(input.kind as (typeof CHANNEL_KINDS)[number])) {
      throw new ValidationError(`Invalid channel kind: ${input.kind}`);
    }
    this.assertChannelConfig(input.kind, input.config);
    return this.channels.create(userId, {
      ...input,
      name: input.name.trim(),
    });
  }

  async updateChannel(
    id: string,
    userId: string,
    input: UpdateAlertChannelInput
  ): Promise<AlertChannel> {
    if (input.config || input.kind) {
      const current = await this.channels.findByIdForUser(id, userId);
      if (!current) throw new NotFoundError('Alert channel');
      this.assertChannelConfig(
        input.kind ?? current.kind,
        input.config ?? current.config
      );
    }
    const updated = await this.channels.update(id, userId, input);
    if (!updated) throw new NotFoundError('Alert channel');
    return updated;
  }

  async deleteChannel(id: string, userId: string): Promise<void> {
    const ok = await this.channels.delete(id, userId);
    if (!ok) throw new NotFoundError('Alert channel');
  }

  listRules(userId: string): Promise<AlertRule[]> {
    return this.rules.listByUser(userId);
  }

  async createRule(
    userId: string,
    input: CreateAlertRuleInput
  ): Promise<AlertRule> {
    if (!input.name?.trim()) throw new ValidationError('name is required');
    if (!input.channels?.length) {
      throw new ValidationError('At least one channel is required');
    }
    await this.assertChannelsOwned(userId, input.channels.map((c) => c.channel_id));
    return this.rules.create(userId, {
      ...input,
      name: input.name.trim(),
    });
  }

  async updateRule(
    id: string,
    userId: string,
    input: UpdateAlertRuleInput
  ): Promise<AlertRule> {
    if (input.channels) {
      if (input.channels.length === 0) {
        throw new ValidationError('At least one channel is required');
      }
      await this.assertChannelsOwned(
        userId,
        input.channels.map((c) => c.channel_id)
      );
    }
    const updated = await this.rules.update(id, userId, input);
    if (!updated) throw new NotFoundError('Alert rule');
    return updated;
  }

  async deleteRule(id: string, userId: string): Promise<void> {
    const ok = await this.rules.delete(id, userId);
    if (!ok) throw new NotFoundError('Alert rule');
  }

  listDeliveries(userId: string): Promise<AlertDelivery[]> {
    return this.deliveries.listRecentByUser(userId, 50);
  }

  private assertChannelConfig(
    kind: string,
    config: Record<string, unknown>
  ): void {
    switch (kind) {
      case 'telegram':
        if (!config.bot_token && !config.telegram_bot_token) {
          throw new ValidationError('Telegram requires bot_token');
        }
        if (!config.chat_id && !config.telegram_chat_id) {
          throw new ValidationError('Telegram requires chat_id');
        }
        break;
      case 'whatsapp':
        if (!config.phone && !config.whatsapp_phone) {
          throw new ValidationError('WhatsApp requires phone');
        }
        if (!config.api_key && !config.whatsapp_api_key) {
          throw new ValidationError('WhatsApp requires api_key');
        }
        break;
      case 'email':
        if (!config.to) throw new ValidationError('Email requires to');
        break;
      case 'webhook':
      case 'slack':
      case 'discord':
      case 'teams':
        if (!config.url) throw new ValidationError(`${kind} requires url`);
        break;
    }
  }

  private async assertChannelsOwned(
    userId: string,
    channelIds: string[]
  ): Promise<void> {
    for (const id of channelIds) {
      const ch = await this.channels.findByIdForUser(id, userId);
      if (!ch) throw new ValidationError(`Channel not found: ${id}`);
    }
  }
}
