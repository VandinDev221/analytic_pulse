import {
  NotFoundError,
  ValidationError,
  type Incident,
  type IncidentDetail,
  type IncidentStatus,
  type UpdateIncidentInput,
} from '@analytic-pulse/shared';
import {
  mapIncident,
  type IncidentRepository,
} from '../repositories/IncidentRepository';
import { realtimeHub } from '../../realtime';

const ACTIVE_STATUSES: IncidentStatus[] = [
  'open',
  'acknowledged',
  'investigating',
];

export class IncidentService {
  constructor(private readonly incidents: IncidentRepository) {}

  async list(
    userId: string,
    status?: IncidentStatus | 'active' | 'all'
  ): Promise<Incident[]> {
    const rows = await this.incidents.listByUser(userId, { status });
    const affectedMap = await this.incidents.getAffectedMonitorsBatch(
      rows.map((r) => r.id)
    );
    return rows.map((row) => mapIncident(row, affectedMap[row.id] ?? []));
  }

  async getDetail(id: string, userId: string): Promise<IncidentDetail> {
    const row = await this.incidents.findByIdForUser(id, userId);
    if (!row) throw new NotFoundError('Incident');

    const [affected, timeline, comments] = await Promise.all([
      this.incidents.getAffectedMonitors(id),
      this.incidents.listTimeline(id),
      this.incidents.listComments(id),
    ]);

    return {
      ...mapIncident(row, affected),
      timeline,
      comments,
    };
  }

  async update(
    id: string,
    userId: string,
    input: UpdateIncidentInput
  ): Promise<IncidentDetail> {
    const current = await this.incidents.findByIdForUser(id, userId);
    if (!current) throw new NotFoundError('Incident');

    const patch: UpdateIncidentInput & {
      acknowledged_at?: Date;
      acknowledged_by?: string;
      resolved_at?: Date;
      resolved_by?: string;
      recovered_at?: Date;
    } = { ...input };

    if (input.status && input.status !== current.status) {
      if (input.status === 'acknowledged') {
        patch.acknowledged_at = new Date();
        patch.acknowledged_by = userId;
        await this.incidents.addTimelineEvent({
          incidentId: id,
          eventType: 'incident_acknowledged',
          message: 'Incident acknowledged',
          actorUserId: userId,
        });
      } else if (input.status === 'investigating') {
        await this.incidents.addTimelineEvent({
          incidentId: id,
          eventType: 'incident_investigating',
          message: 'Investigation started',
          actorUserId: userId,
        });
      } else if (input.status === 'resolved') {
        patch.resolved_at = new Date();
        patch.resolved_by = userId;
        if (!current.recovered_at) {
          patch.recovered_at = new Date();
        }
        await this.incidents.addTimelineEvent({
          incidentId: id,
          eventType: 'incident_resolved',
          message: 'Incident resolved',
          actorUserId: userId,
        });
      } else if (input.status === 'open' && current.status === 'resolved') {
        throw new ValidationError('Cannot reopen a resolved incident');
      }
    }

    if (
      input.severity !== undefined &&
      input.severity !== current.severity
    ) {
      await this.incidents.addTimelineEvent({
        incidentId: id,
        eventType: 'severity_changed',
        message: `Severity changed: ${current.severity} → ${input.severity}`,
        actorUserId: userId,
        metadata: { from: current.severity, to: input.severity },
      });
    }

    if (
      input.root_cause !== undefined &&
      input.root_cause !== current.root_cause
    ) {
      await this.incidents.addTimelineEvent({
        incidentId: id,
        eventType: 'root_cause_updated',
        message: 'Root cause updated',
        actorUserId: userId,
      });
    }

    if (input.notes !== undefined && input.notes !== current.notes) {
      await this.incidents.addTimelineEvent({
        incidentId: id,
        eventType: 'note_updated',
        message: 'Notes updated',
        actorUserId: userId,
      });
    }

    const updated = await this.incidents.update(id, userId, patch);
    if (!updated) throw new NotFoundError('Incident');

    realtimeHub.publish(userId, {
      type: 'incident.changed',
      payload: {
        incident_id: id,
        status: input.status ?? current.status,
      },
    });

    return this.getDetail(id, userId);
  }

  async acknowledge(id: string, userId: string): Promise<IncidentDetail> {
    return this.update(id, userId, { status: 'acknowledged' });
  }

  async resolve(id: string, userId: string): Promise<IncidentDetail> {
    return this.update(id, userId, { status: 'resolved' });
  }

  async addComment(
    id: string,
    userId: string,
    body: string
  ): Promise<IncidentDetail> {
    if (!body?.trim()) {
      throw new ValidationError('Comment body is required');
    }

    const current = await this.incidents.findByIdForUser(id, userId);
    if (!current) throw new NotFoundError('Incident');

    await this.incidents.addComment({
      incidentId: id,
      userId,
      body: body.trim(),
    });

    await this.incidents.addTimelineEvent({
      incidentId: id,
      eventType: 'comment_added',
      message: body.trim().slice(0, 200),
      actorUserId: userId,
    });

    return this.getDetail(id, userId);
  }

  /**
   * Abre incidente quando monitor cai; recupera quando sobe.
   * Chamado pelo CheckOrchestrator (sem HTTP).
   */
  async handleMonitorStatusChange(input: {
    userId: string;
    monitorId: string;
    monitorName: string;
    monitorUrl: string;
    isUp: boolean;
    statusCode: number | null;
    errorMessage: string | null;
    alertSent: boolean;
  }): Promise<void> {
    if (!input.isUp) {
      await this.openOrExtendIncident(input);
      return;
    }
    await this.recoverIncident(input);
  }

  private async openOrExtendIncident(input: {
    userId: string;
    monitorId: string;
    monitorName: string;
    monitorUrl: string;
    statusCode: number | null;
    errorMessage: string | null;
    alertSent: boolean;
  }): Promise<void> {
    const existing = await this.incidents.findOpenByMonitor(input.monitorId);

    if (existing) {
      await this.incidents.addTimelineEvent({
        incidentId: existing.id,
        eventType: 'monitor_down',
        message: `${input.monitorName} still down${
          input.errorMessage ? `: ${input.errorMessage}` : ''
        }`,
        metadata: {
          monitor_id: input.monitorId,
          status_code: input.statusCode,
          error: input.errorMessage,
        },
      });
      if (input.alertSent) {
        await this.incidents.addTimelineEvent({
          incidentId: existing.id,
          eventType: 'alert_sent',
          message: 'Alert notification sent',
          metadata: { monitor_id: input.monitorId },
        });
      }
      return;
    }

    const title = `${input.monitorName} is down`;
    const incident = await this.incidents.create({
      userId: input.userId,
      title,
      severity: 'major',
      monitorIds: [input.monitorId],
      tags: ['auto'],
    });

    await this.incidents.addTimelineEvent({
      incidentId: incident.id,
      eventType: 'incident_opened',
      message: `Incident opened for ${input.monitorName}`,
      metadata: { monitor_id: input.monitorId, url: input.monitorUrl },
    });

    await this.incidents.addTimelineEvent({
      incidentId: incident.id,
      eventType: 'monitor_down',
      message: input.errorMessage
        ? `Monitor down: ${input.errorMessage}`
        : `Monitor down${
            input.statusCode ? ` (HTTP ${input.statusCode})` : ''
          }`,
      metadata: {
        monitor_id: input.monitorId,
        status_code: input.statusCode,
        error: input.errorMessage,
      },
    });

    if (input.alertSent) {
      await this.incidents.addTimelineEvent({
        incidentId: incident.id,
        eventType: 'alert_sent',
        message: 'Alert notification sent',
        metadata: { monitor_id: input.monitorId },
      });
    }
  }

  private async recoverIncident(input: {
    userId: string;
    monitorId: string;
    monitorName: string;
    alertSent: boolean;
  }): Promise<void> {
    const existing = await this.incidents.findOpenByMonitor(input.monitorId);
    if (!existing) return;

    await this.incidents.addTimelineEvent({
      incidentId: existing.id,
      eventType: 'monitor_up',
      message: `${input.monitorName} recovered`,
      metadata: { monitor_id: input.monitorId },
    });

    if (input.alertSent) {
      await this.incidents.addTimelineEvent({
        incidentId: existing.id,
        eventType: 'alert_sent',
        message: 'Recovery alert sent',
        metadata: { monitor_id: input.monitorId },
      });
    }

    const affected = await this.incidents.getAffectedMonitors(existing.id);
    const stillDown = affected.filter(
      (m) => m.id !== input.monitorId && m.status === 'down'
    );

    if (stillDown.length > 0) {
      return;
    }

    if (!ACTIVE_STATUSES.includes(existing.status)) return;

    await this.incidents.update(existing.id, input.userId, {
      status: 'resolved',
      recovered_at: new Date(),
      resolved_at: new Date(),
    });

    await this.incidents.addTimelineEvent({
      incidentId: existing.id,
      eventType: 'incident_resolved',
      message: 'Incident auto-resolved after recovery',
      metadata: { auto: true },
    });
  }
}
