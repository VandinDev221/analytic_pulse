import type {
  AlertChannel,
  AlertDelivery,
  AlertDeliveryStatus,
  AlertRule,
  CreateAlertChannelInput,
  CreateAlertRuleInput,
  UpdateAlertChannelInput,
  UpdateAlertRuleInput,
} from '@analytic-pulse/shared';

export interface AlertChannelRepository {
  listByUser(userId: string): Promise<AlertChannel[]>;
  findByIdForUser(id: string, userId: string): Promise<AlertChannel | null>;
  create(userId: string, input: CreateAlertChannelInput): Promise<AlertChannel>;
  update(
    id: string,
    userId: string,
    input: UpdateAlertChannelInput
  ): Promise<AlertChannel | null>;
  delete(id: string, userId: string): Promise<boolean>;
}

export interface AlertRuleRepository {
  listByUser(userId: string): Promise<AlertRule[]>;
  listEnabledForMonitor(
    userId: string,
    monitorId: string
  ): Promise<AlertRule[]>;
  findByIdForUser(id: string, userId: string): Promise<AlertRule | null>;
  create(userId: string, input: CreateAlertRuleInput): Promise<AlertRule>;
  update(
    id: string,
    userId: string,
    input: UpdateAlertRuleInput
  ): Promise<AlertRule | null>;
  delete(id: string, userId: string): Promise<boolean>;
  countEnabledByUser(userId: string): Promise<number>;
}

export interface AlertDeliveryRepository {
  enqueue(input: {
    ruleId: string;
    channelId: string;
    monitorId: string | null;
    fingerprint: string;
    escalationStep: number;
    payload: Record<string, unknown>;
    scheduledAt?: Date;
  }): Promise<AlertDelivery>;
  findDue(limit?: number): Promise<AlertDelivery[]>;
  markSent(id: string): Promise<void>;
  markFailed(id: string, error: string, nextAttempt?: Date | null): Promise<void>;
  markSuppressed(id: string, reason: string): Promise<void>;
  lastSentAt(fingerprint: string): Promise<Date | null>;
  listRecentByUser(userId: string, limit?: number): Promise<AlertDelivery[]>;
}

export function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export function mapChannel(row: Record<string, unknown>): AlertChannel {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    kind: row.kind as AlertChannel['kind'],
    config:
      row.config && typeof row.config === 'object'
        ? (row.config as Record<string, unknown>)
        : {},
    is_enabled: Boolean(row.is_enabled),
    created_at: toIso(row.created_at as Date | string)!,
    updated_at: toIso(row.updated_at as Date | string)!,
  };
}

export function mapDelivery(row: Record<string, unknown>): AlertDelivery {
  return {
    id: row.id as string,
    rule_id: row.rule_id as string,
    channel_id: row.channel_id as string,
    monitor_id: (row.monitor_id as string | null) ?? null,
    incident_id: (row.incident_id as string | null) ?? null,
    fingerprint: row.fingerprint as string,
    status: row.status as AlertDeliveryStatus,
    attempt: Number(row.attempt ?? 0),
    escalation_step: Number(row.escalation_step ?? 0),
    payload:
      row.payload && typeof row.payload === 'object'
        ? (row.payload as Record<string, unknown>)
        : {},
    last_error: (row.last_error as string | null) ?? null,
    scheduled_at: toIso(row.scheduled_at as Date | string)!,
    fired_at: toIso(row.fired_at as Date | string | null),
    created_at: toIso(row.created_at as Date | string)!,
  };
}
