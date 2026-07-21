import {
  NotFoundError,
  ValidationError,
  type CreateMonitorInput,
  type Monitor,
  type MonitorMetricsResponse,
  type UpdateMonitorInput,
} from '@analytic-pulse/shared';
import type { MonitorRepository } from '../repositories/MonitorRepository';

function assertValidUrl(url: string): void {
  try {
    new URL(url);
  } catch {
    throw new ValidationError('Invalid URL format');
  }
}

export class MonitorService {
  constructor(private readonly monitors: MonitorRepository) {}

  async create(userId: string, input: CreateMonitorInput): Promise<Monitor> {
    if (!input.name?.trim() || !input.url?.trim()) {
      throw new ValidationError('name and url are required');
    }
    assertValidUrl(input.url);
    return this.monitors.create(userId, {
      name: input.name.trim(),
      url: input.url.trim(),
      method: input.method ?? 'GET',
      interval_minutes: input.interval_minutes ?? 5,
    });
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
    if (input.url !== undefined) {
      assertValidUrl(input.url);
    }

    const hasField = Object.values(input).some((v) => v !== undefined);
    if (!hasField) {
      throw new ValidationError('No fields to update');
    }

    const updated = await this.monitors.update(id, userId, input);
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
