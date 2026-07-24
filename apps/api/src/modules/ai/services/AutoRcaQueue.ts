import { env } from '../../../config/env';
import { logger } from '../../../observability/logger';
import { inc } from '../../../observability/metrics';
import { PgIncidentRepository } from '../../incidents/repositories/PgIncidentRepository';
import { IncidentService } from '../../incidents/services/IncidentService';
import { IncidentAnalyzerService } from './IncidentAnalyzerService';
import { GroqClient } from './GroqClient';

type Job = { userId: string; incidentId: string };

const queue: Job[] = [];
const inFlight = new Set<string>();
let running = 0;
const MAX_CONCURRENT = 2;
const DELAY_MS = 2500;

const userWindow = new Map<string, number[]>();
const MAX_PER_USER_PER_MIN = 3;

function withinUserBudget(userId: string): boolean {
  const now = Date.now();
  const window = (userWindow.get(userId) || []).filter((t) => now - t < 60_000);
  userWindow.set(userId, window);
  return window.length < MAX_PER_USER_PER_MIN;
}

function recordUser(userId: string): void {
  const now = Date.now();
  const window = (userWindow.get(userId) || []).filter((t) => now - t < 60_000);
  window.push(now);
  userWindow.set(userId, window);
}

function pump(): void {
  while (running < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift()!;
    const key = `${job.userId}:${job.incidentId}`;
    if (inFlight.has(key)) continue;
    inFlight.add(key);
    running += 1;

    void (async () => {
      try {
        await new Promise((r) => setTimeout(r, DELAY_MS));
        if (!withinUserBudget(job.userId)) {
          logger.info('Auto RCA skipped — user rate limit', {
            userId: job.userId,
            incidentId: job.incidentId,
          });
          inc('ai_rca_skipped_total');
          return;
        }
        recordUser(job.userId);
        const analyzer = new IncidentAnalyzerService(
          new IncidentService(new PgIncidentRepository()),
          new GroqClient()
        );
        await analyzer.analyze(job.userId, job.incidentId, {
          trigger: 'auto',
          force: false,
        });
        inc('ai_rca_auto_total');
      } catch (error) {
        logger.warn('Auto RCA failed', {
          incidentId: job.incidentId,
          error: error instanceof Error ? error.message : String(error),
        });
        inc('ai_rca_failed_total');
      } finally {
        inFlight.delete(key);
        running -= 1;
        pump();
      }
    })();
  }
}

/**
 * Enfileira análise automática após abertura de incidente.
 * No-op se GROQ/AI_RCA_AUTO desligado.
 */
export function enqueueAutoRca(userId: string, incidentId: string): void {
  if (!env.aiRcaAutoEnabled) return;
  if (!env.groqApiKey) return;

  const key = `${userId}:${incidentId}`;
  if (inFlight.has(key) || queue.some((j) => `${j.userId}:${j.incidentId}` === key)) {
    return;
  }

  queue.push({ userId, incidentId });
  logger.info('Auto RCA enqueued', { incidentId, userId });
  pump();
}
