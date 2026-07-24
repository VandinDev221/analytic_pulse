import type { IncidentAiAnalysis } from '@analytic-pulse/shared';
import { AppError } from '@analytic-pulse/shared';
import { env } from '../../../config/env';
import { logger } from '../../../observability/logger';
import { inc } from '../../../observability/metrics';
import { realtimeHub } from '../../realtime';
import type { IncidentService } from '../../incidents/services/IncidentService';
import { buildIncidentAnalysisMessages } from '../prompts/incidentAnalysisPrompt';
import { GroqClient } from './GroqClient';
import type {
  AiExplainedItem,
  AiSuggestedAction,
  AiSuggestionRisk,
  IncidentDetail,
} from '@analytic-pulse/shared';

const FALLBACK_EXPLANATION =
  'Sem explicação disponível — valide manualmente antes de agir.';

const DISCLAIMER =
  'Sugestão de IA — não é autoridade. Valide no painel e na infraestrutura antes de agir.';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asRisk(value: unknown): AiSuggestionRisk {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  return 'medium';
}

function parseExplainedList(raw: unknown): AiExplainedItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const obj = item as Record<string, unknown>;
      const text = asString(obj.text || obj.hypothesis || obj.action);
      if (!text) return null;
      return {
        text,
        explanation: asString(obj.explanation, FALLBACK_EXPLANATION),
      };
    })
    .filter((x): x is AiExplainedItem => Boolean(x))
    .slice(0, 6);
}

function parseActions(raw: unknown): AiSuggestedAction[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const obj = item as Record<string, unknown>;
      const text = asString(obj.text || obj.action);
      if (!text) return null;
      return {
        text,
        explanation: asString(obj.explanation, FALLBACK_EXPLANATION),
        risk: asRisk(obj.risk),
      };
    })
    .filter((x): x is AiSuggestedAction => Boolean(x))
    .slice(0, 6);
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('invalid json');
    return JSON.parse(match[0]);
  }
}

function normalize(
  incidentId: string,
  parsed: unknown,
  model: string,
  trigger: 'auto' | 'manual'
): IncidentAiAnalysis {
  const obj =
    parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {};

  const possible_causes = parseExplainedList(obj.possible_causes);
  const suggested_actions = parseActions(obj.suggested_actions);

  return {
    incident_id: incidentId,
    summary: asString(
      obj.summary,
      'Análise incompleta — revise o incidente manualmente.'
    ),
    possible_causes:
      possible_causes.length > 0
        ? possible_causes
        : [
            {
              text: 'Causa não determinada pela IA',
              explanation: FALLBACK_EXPLANATION,
            },
          ],
    suggested_actions:
      suggested_actions.length > 0
        ? suggested_actions
        : [
            {
              text: 'Revisar timeline e monitores afetados no painel',
              explanation: FALLBACK_EXPLANATION,
              risk: 'low',
            },
          ],
    explanation: asString(obj.explanation, FALLBACK_EXPLANATION),
    generated_at: new Date().toISOString(),
    model,
    disclaimer: DISCLAIMER,
    trigger,
  };
}

/**
 * Análise de incidente (manual ou automática).
 * Isolado: NÃO altera status, root_cause ou regras de negócio —
 * apenas grava sugestão em ai_analysis.
 */
export class IncidentAnalyzerService {
  constructor(
    private readonly incidents: IncidentService,
    private readonly groq = new GroqClient()
  ) {}

  getStatus(): { enabled: boolean; model: string | null; auto_rca: boolean } {
    const enabled = this.groq.isEnabled();
    return {
      enabled,
      model: enabled ? env.groqModel : null,
      auto_rca: enabled && env.aiRcaAutoEnabled,
    };
  }

  async analyze(
    userId: string,
    incidentId: string,
    opts?: { trigger?: 'auto' | 'manual'; force?: boolean }
  ): Promise<IncidentAiAnalysis> {
    const trigger = opts?.trigger ?? 'manual';
    const force = opts?.force ?? trigger === 'manual';

    if (!this.groq.isEnabled()) {
      throw new AppError(
        'INTERNAL_ERROR',
        'IA desabilitada. Defina GROQ_API_KEY no servidor.',
        503
      );
    }

    const claimed = await this.incidents.claimAiAnalysis(incidentId, userId, {
      force,
    });
    if (!claimed && trigger === 'auto') {
      const detail = await this.incidents.getDetail(incidentId, userId);
      if (detail.ai_analysis) return detail.ai_analysis;
      throw new AppError(
        'CONFLICT',
        'Análise de IA já em andamento ou concluída',
        409
      );
    }
    if (!claimed && trigger === 'manual') {
      // force deveria ter claimado; se falhou, tenta mesmo assim
    }

    try {
      const detail: IncidentDetail = await this.incidents.getDetail(
        incidentId,
        userId
      );
      const messages = buildIncidentAnalysisMessages(detail);
      const raw = await this.groq.chat(messages, {
        temperature: 0.2,
        maxTokens: 1800,
        json: true,
      });

      let parsed: unknown;
      try {
        parsed = extractJson(raw);
      } catch {
        throw new AppError(
          'INTERNAL_ERROR',
          'A IA retornou um formato inválido. Tente novamente.',
          502
        );
      }

      const analysis = normalize(detail.id, parsed, env.groqModel, trigger);
      await this.incidents.saveAiAnalysis(incidentId, userId, analysis, 'ready');

      await this.incidents.addSystemTimeline(incidentId, {
        eventType: 'ai_analysis_ready',
        message:
          trigger === 'auto'
            ? 'Análise automática de IA concluída (sugestão)'
            : 'Análise de IA concluída (sugestão)',
        metadata: { trigger, model: analysis.model },
      });

      realtimeHub.publish(userId, {
        type: 'incident.changed',
        payload: {
          incident_id: incidentId,
          ai_analysis_status: 'ready',
        },
      });

      inc('ai_rca_ready_total');
      return analysis;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha na análise de IA';
      try {
        await this.incidents.saveAiAnalysis(
          incidentId,
          userId,
          {
            incident_id: incidentId,
            summary: 'Falha ao gerar análise automática',
            possible_causes: [
              {
                text: 'Análise indisponível',
                explanation: message,
              },
            ],
            suggested_actions: [
              {
                text: 'Tente “Reanalisar” no detalhe do incidente',
                explanation: FALLBACK_EXPLANATION,
                risk: 'low',
              },
            ],
            explanation: message,
            generated_at: new Date().toISOString(),
            model: env.groqModel,
            disclaimer: DISCLAIMER,
            trigger,
          },
          'failed'
        );
        await this.incidents.addSystemTimeline(incidentId, {
          eventType: 'ai_analysis_failed',
          message: `Falha na análise de IA: ${message}`.slice(0, 200),
          metadata: { trigger },
        });
        realtimeHub.publish(userId, {
          type: 'incident.changed',
          payload: {
            incident_id: incidentId,
            ai_analysis_status: 'failed',
          },
        });
      } catch (persistErr) {
        logger.warn('Failed to persist AI RCA failure', {
          incidentId,
          error:
            persistErr instanceof Error
              ? persistErr.message
              : String(persistErr),
        });
      }
      throw error;
    }
  }
}
