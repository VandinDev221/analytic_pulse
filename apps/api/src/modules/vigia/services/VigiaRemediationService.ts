import type {
  VigiaAction,
  VigiaPlaybookId,
  VigiaSeverity,
} from '@analytic-pulse/shared';
import { env } from '../../../config/env';
import { logger } from '../../../observability/logger';
import { query } from '../../../infrastructure/db';
import { PgMonitorRepository } from '../../monitoring/repositories/PgMonitorRepository';
import { CheckOrchestrator } from '../../monitoring/services/CheckOrchestrator';
import { runCheck, type CheckableMonitor } from '../../monitoring/checkers';
import { IncidentService } from '../../incidents/services/IncidentService';
import { PgIncidentRepository } from '../../incidents/repositories/PgIncidentRepository';
import { realtimeHub } from '../../realtime';
import { VigiaRepository } from '../repositories/VigiaRepository';

const ALLOWLIST: VigiaPlaybookId[] = [
  'recheck_monitor',
  'ack_known_noise',
  'ssl_warn',
  'agent_stale',
  'api_unhealthy',
];

export class VigiaRemediationService {
  constructor(private readonly repo = new VigiaRepository()) {}

  isAllowed(playbookId: string): playbookId is VigiaPlaybookId {
    return ALLOWLIST.includes(playbookId as VigiaPlaybookId);
  }

  async isCircuitOpen(userId: string): Promise<boolean> {
    const session = await this.repo.getSession(userId);
    const until = session?.circuit_open_until
      ? new Date(session.circuit_open_until as string).getTime()
      : 0;
    return until > Date.now();
  }

  async runPlaybook(
    userId: string,
    playbookId: VigiaPlaybookId,
    ctx: {
      title: string;
      explanation: string;
      severity: VigiaSeverity;
      targetType?: string;
      targetId?: string;
      input?: Record<string, unknown>;
    }
  ): Promise<VigiaAction> {
    if (!env.vigiaAutoRemediate) {
      return this.repo.insertAction({
        userId,
        playbookId,
        severity: ctx.severity,
        status: 'skipped',
        title: ctx.title,
        explanation: 'Auto-remediação desligada (VIGIA_AUTO_REMEDIATE=false).',
        targetType: ctx.targetType,
        targetId: ctx.targetId,
        input: ctx.input,
        finished: true,
      });
    }

    if (await this.isCircuitOpen(userId)) {
      return this.repo.insertAction({
        userId,
        playbookId,
        severity: 'critical',
        status: 'skipped',
        title: ctx.title,
        explanation: 'Circuit breaker aberto — Vigia em pausa temporária.',
        targetType: ctx.targetType,
        targetId: ctx.targetId,
        finished: true,
      });
    }

    const hourCount = await this.repo.countActionsLastHour(userId);
    if (hourCount >= env.vigiaMaxActionsPerHour) {
      return this.repo.insertAction({
        userId,
        playbookId,
        severity: 'warn',
        status: 'skipped',
        title: ctx.title,
        explanation: `Limite de ${env.vigiaMaxActionsPerHour} ações/hora atingido.`,
        targetType: ctx.targetType,
        targetId: ctx.targetId,
        finished: true,
      });
    }

    const action = await this.repo.insertAction({
      userId,
      playbookId,
      severity: ctx.severity,
      status: 'running',
      title: ctx.title,
      explanation: ctx.explanation,
      targetType: ctx.targetType,
      targetId: ctx.targetId,
      input: ctx.input,
    });

    try {
      const result = await this.execute(userId, playbookId, ctx);
      const updated = await this.repo.updateAction(action.id, {
        status: 'succeeded',
        result,
        explanation: ctx.explanation,
      });
      await this.repo.recordSuccess(userId);
      realtimeHub.publish(userId, {
        type: 'vigia.action',
        payload: { action_id: action.id, playbook_id: playbookId, status: 'succeeded' },
      });
      return updated || action;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Vigia playbook failed', { playbookId, userId, error: message });
      const { openCircuit } = await this.repo.recordFailure(userId);
      const updated = await this.repo.updateAction(action.id, {
        status: 'failed',
        result: { error: message },
        explanation: ctx.explanation,
      });
      realtimeHub.publish(userId, {
        type: 'vigia.action',
        payload: {
          action_id: action.id,
          playbook_id: playbookId,
          status: 'failed',
          circuit_open: openCircuit,
        },
      });
      return updated || action;
    }
  }

  private async execute(
    userId: string,
    playbookId: VigiaPlaybookId,
    ctx: {
      targetId?: string;
      input?: Record<string, unknown>;
    }
  ): Promise<Record<string, unknown>> {
    switch (playbookId) {
      case 'recheck_monitor':
        return this.recheckMonitor(userId, ctx.targetId!);
      case 'ack_known_noise':
        return this.ackIncident(userId, ctx.targetId!);
      case 'ssl_warn':
        return {
          notified: true,
          monitor_id: ctx.targetId,
          days: ctx.input?.days ?? null,
        };
      case 'agent_stale': {
        const ok = await this.repo.markAgentOffline(ctx.targetId!, userId);
        return { marked_offline: ok, agent_id: ctx.targetId };
      }
      case 'api_unhealthy':
        return {
          notified: true,
          hint: 'Health check falhou. Verifique o serviço analytic-pulse-api.',
        };
      default:
        throw new Error(`Playbook não permitido: ${playbookId}`);
    }
  }

  private async recheckMonitor(
    userId: string,
    monitorId: string
  ): Promise<Record<string, unknown>> {
    const monitors = new PgMonitorRepository();
    const monitor = await monitors.findByIdForUser(monitorId, userId);
    if (!monitor) throw new Error('Monitor não encontrado');

    const checkable = monitor as unknown as CheckableMonitor & {
      user_id: string;
      status: typeof monitor.status;
      ssl_last_warned_at?: string | null;
    };
    const result = await runCheck(checkable);
    const orchestrator = new CheckOrchestrator(monitors);
    await orchestrator.applyExternalCheck(
      checkable,
      {
        ...result,
        meta: { ...(result.meta ?? {}), probe_source: 'vigia', probe_region: env.defaultProbeRegion },
      },
      env.defaultProbeRegion
    );

    return {
      is_up: result.is_up,
      response_time_ms: result.response_time_ms,
      status_code: result.status_code,
      error_message: result.error_message,
    };
  }

  private async ackIncident(
    userId: string,
    incidentId: string
  ): Promise<Record<string, unknown>> {
    const service = new IncidentService(new PgIncidentRepository());
    const detail = await service.acknowledge(incidentId, userId);
    return { incident_id: detail.id, status: detail.status };
  }

  /** Incidentes com tag "noise" ou "ruido" podem ser auto-ack. */
  async isNoiseIncident(tags: string[] | null | undefined): Promise<boolean> {
    if (!tags?.length) return false;
    return tags.some((t) =>
      ['noise', 'ruido', 'ruído', 'known-noise'].includes(t.toLowerCase())
    );
  }

  async checkApiHealth(): Promise<boolean> {
    try {
      await query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
