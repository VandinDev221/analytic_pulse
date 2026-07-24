import {
  CHECK_TYPES,
  NotFoundError,
  ValidationError,
  type CheckType,
  type CreateMonitorInput,
  type Monitor,
  type MonitorMetricsResponse,
  type UpdateMonitorInput,
} from '@analytic-pulse/shared';
import type { MonitorRepository } from '../repositories/MonitorRepository';

function assertValidHttpUrl(url: string): void {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('invalid');
    }
  } catch {
    throw new ValidationError('Invalid URL format — use http:// or https://');
  }
}

function normalizeTarget(input: CreateMonitorInput | UpdateMonitorInput): void {
  const checkType = (input.check_type || 'http') as CheckType;

  if (input.check_type && !CHECK_TYPES.includes(input.check_type)) {
    throw new ValidationError(`Invalid check_type: ${input.check_type}`);
  }

  if (checkType === 'http' || checkType === 'https' || checkType === 'browser') {
    if ('url' in input && input.url) {
      let url = input.url.trim();
      if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
        (input as CreateMonitorInput).url = url;
      }
      assertValidHttpUrl(url);
    }
    return;
  }

  // Non-HTTP: ensure url/host are usable
  if ('url' in input && input.url !== undefined) {
    const host =
      input.host ||
      input.url
        .replace(/^(tcp|ssl|ping|dns):\/\//i, '')
        .split(':')[0]
        ?.trim();
    if (!host) {
      throw new ValidationError('Host is required for this check type');
    }
    if (!input.host) {
      (input as CreateMonitorInput).host = host;
    }
    // Store a canonical target string for display
    if (checkType === 'tcp' || checkType === 'port' || checkType === 'ssl') {
      const port =
        input.port ||
        Number(
          input.url.replace(/^(tcp|ssl):\/\//i, '').split(':')[1]
        ) ||
        (checkType === 'ssl' ? 443 : 80);
      (input as CreateMonitorInput).port = port;
      (input as CreateMonitorInput).url = `${host}:${port}`;
    } else {
      (input as CreateMonitorInput).url = host;
    }
  }
}

export class MonitorService {
  constructor(private readonly monitors: MonitorRepository) {}

  async create(userId: string, input: CreateMonitorInput): Promise<Monitor> {
    if (!input.name?.trim() || !input.url?.trim()) {
      throw new ValidationError('name and url are required');
    }

    const payload: CreateMonitorInput = {
      ...input,
      name: input.name.trim(),
      url: input.url.trim(),
      check_type: input.check_type ?? 'http',
      method: input.method ?? 'GET',
      interval_minutes: input.interval_minutes ?? 5,
    };

    normalizeTarget(payload);
    return this.monitors.create(userId, payload);
  }

  async list(userId: string): Promise<Monitor[]> {
    return this.monitors.findAllByUser(userId);
  }

  async getById(id: string, userId: string): Promise<Monitor> {
    const monitor = await this.monitors.findByIdForUser(id, userId);
    if (!monitor) throw new NotFoundError('Monitor');
    return monitor;
  }

  async update(
    id: string,
    userId: string,
    input: UpdateMonitorInput
  ): Promise<Monitor> {
    const hasField = Object.values(input).some((v) => v !== undefined);
    if (!hasField) {
      throw new ValidationError('No fields to update');
    }

    const payload = { ...input };
    if (payload.url || payload.check_type || payload.host || payload.port) {
      const current = await this.getById(id, userId);
      const merged: CreateMonitorInput = {
        name: current.name,
        check_type: payload.check_type ?? current.check_type,
        url: payload.url ?? current.url,
        host: (payload.host !== undefined ? payload.host : current.host) ?? undefined,
        port: (payload.port !== undefined ? payload.port : current.port) ?? undefined,
      };
      normalizeTarget(merged);
      payload.url = merged.url;
      if (merged.host !== undefined) payload.host = merged.host;
      if (merged.port !== undefined) payload.port = merged.port;
      if (merged.check_type !== undefined) payload.check_type = merged.check_type;
    }

    const updated = await this.monitors.update(id, userId, payload);
    if (!updated) throw new NotFoundError('Monitor');
    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    const deleted = await this.monitors.delete(id, userId);
    if (!deleted) throw new NotFoundError('Monitor');
  }

  async getMetrics(id: string, userId: string): Promise<MonitorMetricsResponse> {
    await this.getById(id, userId);
    const [metrics, recent_logs] = await Promise.all([
      this.monitors.getMetrics(id),
      this.monitors.getRecentLogs(id, 100),
    ]);
    return { metrics, recent_logs };
  }
}
