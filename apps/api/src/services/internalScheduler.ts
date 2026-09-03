import { logger } from '../observability/logger';
import { env } from '../config/env';
import { CheckOrchestrator, PgMonitorRepository } from '../modules/monitoring';
import { VigiaService } from '../modules/vigia/services/VigiaService';

export class InternalScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly orchestrator: CheckOrchestrator;
  private readonly vigia: VigiaService;

  constructor() {
    this.orchestrator = new CheckOrchestrator(new PgMonitorRepository());
    this.vigia = new VigiaService();
  }

  public start(): void {
    if (!env.autoPingEnabled) {
      logger.info('InternalScheduler is disabled by AUTO_PING_ENABLED=false');
      return;
    }

    if (this.timer) {
      return;
    }

    const intervalMs = Math.max(30_000, env.autoPingIntervalMs || 300_000);
    logger.info('InternalScheduler started', {
      interval_ms: intervalMs,
      interval_minutes: Math.round(intervalMs / 60000),
      self_ping: env.selfPingEnabled,
    });

    // Primeira execução atrasada por 10s para estabilizar startup e DB
    setTimeout(() => {
      void this.tick();
    }, 10_000);

    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('InternalScheduler stopped');
    }
  }

  private async tick(): Promise<void> {
    if (this.isRunning) {
      logger.warn('InternalScheduler: previous tick still running, skipping this interval');
      return;
    }

    this.isRunning = true;
    try {
      // 1. Executa o ciclo de monitoramento de todos os monitores
      logger.info('InternalScheduler: running ping cycle...');
      const pingResult = await this.orchestrator.runPingCycle();
      logger.info('InternalScheduler: ping cycle complete', { ...pingResult });

      // 2. Executa a ronda do Vigia se habilitado
      if (env.vigiaEnabled) {
        try {
          const vigiaResult = await this.vigia.runCronTick();
          logger.info('InternalScheduler: vigia tick complete', { ...vigiaResult });
        } catch (vigiaErr) {
          logger.warn('InternalScheduler: vigia tick failed', {
            error: vigiaErr instanceof Error ? vigiaErr.message : String(vigiaErr),
          });
        }
      }

      // 3. Self-ping / Keep-alive HTTP request para a própria API pública
      if (env.selfPingEnabled) {
        await this.selfPing();
      }
    } catch (err) {
      logger.error('InternalScheduler error during tick', {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.isRunning = false;
    }
  }

  private async selfPing(): Promise<void> {
    const rawUrl = env.apiPublicUrl || process.env.RENDER_EXTERNAL_URL;
    if (!rawUrl) {
      return;
    }

    const healthUrl = `${rawUrl.replace(/\/$/, '')}/health`;
    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'AnalyticPulseInternalKeepAlive/1.0' },
      });
      logger.info('InternalScheduler: self-ping keep-alive completed', {
        url: healthUrl,
        status: response.status,
      });
    } catch (err) {
      logger.warn('InternalScheduler: self-ping keep-alive failed', {
        url: healthUrl,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export const internalScheduler = new InternalScheduler();
