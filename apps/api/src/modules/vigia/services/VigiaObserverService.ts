import type { VigiaAction, VigiaSeverity } from '@analytic-pulse/shared';
import { VigiaRepository } from '../repositories/VigiaRepository';
import { VigiaRemediationService } from './VigiaRemediationService';
import { realtimeHub } from '../../realtime';

/**
 * V2: classifica achados e grava propostas (ou executa se modo remediate).
 */
export class VigiaObserverService {
  constructor(
    private readonly repo = new VigiaRepository(),
    private readonly remediation = new VigiaRemediationService()
  ) {}

  async observeAndPropose(userId: string): Promise<{
    findings: VigiaAction[];
    executed: VigiaAction[];
  }> {
    const status = await this.repo.buildStatus(userId);
    if (!status.enabled || status.mode === 'pause') {
      return { findings: [], executed: [] };
    }

    const findings: VigiaAction[] = [];
    const executed: VigiaAction[] = [];

    const [down, ssl, agents, incidents] = await Promise.all([
      this.repo.findDownMonitors(userId),
      this.repo.findSslWarnings(userId),
      this.repo.findStaleAgents(userId),
      this.repo.findOpenIncidents(userId),
    ]);

    for (const m of down) {
      const action = await this.proposeOrRun(userId, status.mode, {
        playbookId: 'recheck_monitor',
        severity: 'actionable',
        title: `Rechecagem: ${m.name} está down`,
        explanation:
          'Monitor reportado como down. Playbook recheck_monitor força um novo ciclo de verificação.',
        targetType: 'monitor',
        targetId: m.id,
        input: { url: m.url },
      });
      this.bucket(action, findings, executed);
    }

    for (const m of ssl) {
      const action = await this.proposeOrRun(userId, status.mode, {
        playbookId: 'ssl_warn',
        severity: Number(m.ssl_days_remaining) <= 7 ? 'critical' : 'warn',
        title: `SSL: ${m.name} com ${m.ssl_days_remaining} dia(s)`,
        explanation:
          'Certificado dentro do limiar. O Vigia notifica; renovação permanece manual.',
        targetType: 'monitor',
        targetId: m.id,
        input: { days: m.ssl_days_remaining },
      });
      this.bucket(action, findings, executed);
    }

    for (const a of agents) {
      const action = await this.proposeOrRun(userId, status.mode, {
        playbookId: 'agent_stale',
        severity: 'warn',
        title: `Agent ${a.name} sem heartbeat`,
        explanation:
          'Sem last_seen recente. Playbook marca o agent como offline e registra a ação.',
        targetType: 'agent',
        targetId: a.id,
      });
      this.bucket(action, findings, executed);
    }

    for (const inc of incidents) {
      const noise = await this.remediation.isNoiseIncident(inc.tags);
      if (!noise) continue;
      const action = await this.proposeOrRun(userId, status.mode, {
        playbookId: 'ack_known_noise',
        severity: 'actionable',
        title: `Ack ruído: ${inc.title}`,
        explanation:
          'Incidente marcado com tag de ruído conhecido. Playbook faz acknowledge automático.',
        targetType: 'incident',
        targetId: inc.id,
      });
      this.bucket(action, findings, executed);
    }

    const healthy = await this.remediation.checkApiHealth();
    if (!healthy) {
      const action = await this.proposeOrRun(userId, status.mode, {
        playbookId: 'api_unhealthy',
        severity: 'critical',
        title: 'API / banco sem resposta',
        explanation:
          'Falha ao consultar o banco. Notificação crítica; redeploy exige flag/credencial dedicada.',
      });
      this.bucket(action, findings, executed);
    }

    return { findings, executed };
  }

  private bucket(
    action: VigiaAction,
    findings: VigiaAction[],
    executed: VigiaAction[]
  ): void {
    if (action.status === 'proposed' || action.status === 'notified') {
      findings.push(action);
    } else {
      executed.push(action);
    }
  }

  private async proposeOrRun(
    userId: string,
    mode: string,
    ctx: {
      playbookId: 'recheck_monitor' | 'ack_known_noise' | 'ssl_warn' | 'agent_stale' | 'api_unhealthy';
      severity: VigiaSeverity;
      title: string;
      explanation: string;
      targetType?: string;
      targetId?: string;
      input?: Record<string, unknown>;
    }
  ): Promise<VigiaAction> {
    if (mode === 'remediate') {
      return this.remediation.runPlaybook(userId, ctx.playbookId, ctx);
    }

    const action = await this.repo.insertAction({
      userId,
      playbookId: ctx.playbookId,
      severity: ctx.severity,
      status: 'proposed',
      title: ctx.title,
      explanation: ctx.explanation,
      targetType: ctx.targetType,
      targetId: ctx.targetId,
      input: ctx.input,
      finished: true,
    });

    realtimeHub.publish(userId, {
      type: 'vigia.action',
      payload: {
        action_id: action.id,
        playbook_id: ctx.playbookId,
        status: 'proposed',
      },
    });

    return action;
  }
}
