import type {
  VigiaGreeting,
  VigiaMode,
  VigiaOverview,
  VigiaStatus,
} from '@analytic-pulse/shared';
import { ValidationError } from '@analytic-pulse/shared';
import { env } from '../../../config/env';
import { logger } from '../../../observability/logger';
import {
  sendTelegramMessage,
  resolveBotToken,
} from '../../../services/telegramApi';
import { query } from '../../../infrastructure/db';
import { realtimeHub } from '../../realtime';
import { VigiaRepository } from '../repositories/VigiaRepository';
import {
  formatDigestHtml,
  VigiaDigestBuilder,
} from './VigiaDigestBuilder';
import { VigiaObserverService } from './VigiaObserverService';

function hourInTz(tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(new Date());
    return Number(parts.find((p) => p.type === 'hour')?.value || 0);
  } catch {
    return new Date().getUTCHours();
  }
}

function salutationForHour(hour: number): {
  salutation: string;
  period: VigiaGreeting['period'];
} {
  if (hour >= 5 && hour < 12) {
    return { salutation: 'Bom dia', period: 'morning' };
  }
  if (hour >= 12 && hour < 18) {
    return { salutation: 'Boa tarde', period: 'afternoon' };
  }
  if (hour >= 18 && hour < 23) {
    return { salutation: 'Boa noite', period: 'evening' };
  }
  return { salutation: 'Boa madrugada', period: 'night' };
}

export class VigiaService {
  constructor(
    private readonly repo = new VigiaRepository(),
    private readonly digests = new VigiaDigestBuilder(),
    private readonly observer = new VigiaObserverService()
  ) {}

  async getStatus(userId: string): Promise<VigiaStatus> {
    if (!env.vigiaEnabled) {
      return {
        enabled: false,
        mode: 'pause',
        auto_remediate: false,
        timezone: env.vigiaTz,
        last_greeting_at: null,
        last_round_at: null,
        last_digest_at: null,
        circuit_open_until: null,
        consecutive_failures: 0,
        online: false,
      };
    }
    return this.repo.buildStatus(userId);
  }

  async greeting(userId: string): Promise<VigiaGreeting> {
    const hour = hourInTz(env.vigiaTz);
    const { salutation, period } = salutationForHour(hour);
    const summary = await this.digests.buildSummary(userId);
    const status = await this.getStatus(userId);
    await this.repo.touchGreeting(userId);

    const lines: string[] = [
      `${salutation}. Sou o Vigia — plantão ${status.mode}.`,
      summary.monitors_down > 0
        ? `${summary.monitors_down} monitor(es) down agora.`
        : 'Todos os monitores ativos estão up.',
      summary.incidents_open > 0
        ? `${summary.incidents_open} incidente(s) em aberto.`
        : 'Nenhum incidente aberto.',
    ];

    if (summary.ssl_critical > 0) {
      lines.push(`${summary.ssl_critical} certificado(s) SSL no limiar.`);
    }
    if (summary.agents_offline > 0) {
      lines.push(`${summary.agents_offline} agent(s) sem heartbeat.`);
    }
    if (summary.predictions[0]) {
      lines.push(`Antecipação: ${summary.predictions[0].title}`);
    }
    if (status.circuit_open_until) {
      lines.push('Circuit breaker ativo — auto-correção pausada temporariamente.');
    }

    return { salutation, period, lines, summary, status };
  }

  async overview(userId: string): Promise<VigiaOverview> {
    const [greeting, latest_digest, recent_actions, recent_rounds] =
      await Promise.all([
        this.greeting(userId),
        this.repo.latestDigest(userId),
        this.repo.listActions(userId, 30),
        this.repo.listRounds(userId, 10),
      ]);

    return {
      status: greeting.status,
      greeting,
      latest_digest,
      recent_actions,
      recent_rounds,
      predictions: greeting.summary.predictions,
    };
  }

  async setMode(userId: string, mode: unknown): Promise<VigiaStatus> {
    if (mode !== 'observe' && mode !== 'remediate' && mode !== 'pause') {
      throw new ValidationError('mode deve ser observe | remediate | pause');
    }
    await this.repo.setMode(userId, mode as VigiaMode);
    return this.getStatus(userId);
  }

  async listActions(userId: string) {
    return this.repo.listActions(userId, 50);
  }

  async listProposed(userId: string) {
    return this.repo.listProposed(userId, 40);
  }

  async generateDigest(
    userId: string,
    options?: { deliverTelegram?: boolean }
  ) {
    const hour = hourInTz(env.vigiaTz);
    const { salutation } = salutationForHour(hour);
    const summary = await this.digests.buildSummary(userId);
    const textHtml = formatDigestHtml(summary, salutation);
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000);

    let delivered = false;
    if (options?.deliverTelegram !== false) {
      delivered = await this.deliverTelegram(userId, textHtml);
    }

    const digest = await this.repo.insertDigest({
      userId,
      periodStart,
      periodEnd,
      summary,
      textHtml,
      deliveredTelegram: delivered,
    });
    await this.repo.touchDigest(userId);
    return digest;
  }

  async deliverTelegram(userId: string, textHtml: string): Promise<boolean> {
    try {
      const settings = await query(
        `SELECT telegram_bot_token, telegram_chat_id
         FROM notification_settings
         WHERE user_id = $1`,
        [userId]
      );
      const row = settings.rows[0] as
        | { telegram_bot_token?: string; telegram_chat_id?: string }
        | undefined;
      const token =
        row?.telegram_bot_token ||
        env.telegramBotToken ||
        (await resolveBotToken());
      const chatId =
        env.vigiaTelegramChatId || row?.telegram_chat_id || undefined;
      if (!token || !chatId) return false;
      await sendTelegramMessage(
        { bot_token: token, chat_id: String(chatId) },
        textHtml
      );
      return true;
    } catch (error) {
      logger.warn('Vigia telegram delivery failed', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /** Ronda sentinela (V5) — observe/propose/remediate. */
  async runRound(userId: string) {
    const status = await this.getStatus(userId);
    if (!status.enabled || status.mode === 'pause') {
      return { skipped: true, reason: status.mode === 'pause' ? 'pause' : 'disabled' };
    }

    const { findings, executed } = await this.observer.observeAndPropose(userId);
    await this.repo.insertRound({
      userId,
      mode: status.mode,
      findings: findings.length,
      actionsRun: executed.length,
      meta: {
        finding_ids: findings.map((f) => f.id),
        executed_ids: executed.map((e) => e.id),
      },
    });
    await this.repo.touchRound(userId);

    realtimeHub.publish(userId, {
      type: 'vigia.round',
      payload: {
        findings: findings.length,
        actions_run: executed.length,
        mode: status.mode,
      },
    });

    // Resumo noturno curto se houve ações
    const hour = hourInTz(env.vigiaTz);
    if ((executed.length > 0 || findings.length > 0) && hour >= 22) {
      await this.deliverTelegram(
        userId,
        `🌙 <b>Resumo noturno do Vigia</b>\n• Achados: ${findings.length}\n• Ações: ${executed.length}`
      );
    }

    return {
      skipped: false,
      findings: findings.length,
      actions_run: executed.length,
      mode: status.mode,
    };
  }

  /** Cron: digest diário no horário configurado + ronda sentinela. */
  async runCronTick(): Promise<{
    digests: number;
    rounds: number;
    errors: number;
  }> {
    if (!env.vigiaEnabled) {
      return { digests: 0, rounds: 0, errors: 0 };
    }

    const users = await this.repo.listUserIds();
    let digests = 0;
    let rounds = 0;
    let errors = 0;
    const hour = hourInTz(env.vigiaTz);

    for (const userId of users) {
      try {
        await this.runRound(userId);
        rounds += 1;

        if (hour === env.vigiaDigestHour) {
          const session = await this.repo.getSession(userId);
          const last = session?.last_digest_at
            ? new Date(session.last_digest_at as string).getTime()
            : 0;
          const sinceHours = (Date.now() - last) / 3_600_000;
          if (sinceHours >= 20 || !last) {
            await this.generateDigest(userId, { deliverTelegram: true });
            digests += 1;
          }
        }
      } catch (error) {
        errors += 1;
        logger.error('Vigia cron user failed', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { digests, rounds, errors };
  }
}
