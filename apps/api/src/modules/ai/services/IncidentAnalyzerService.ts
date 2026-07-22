import type {
  AiExplainedItem,
  AiSuggestedAction,
  AiSuggestionRisk,
  IncidentAiAnalysis,
  IncidentDetail,
} from '@analytic-pulse/shared';
import { AppError } from '@analytic-pulse/shared';
import { env } from '../../../config/env';
import type { IncidentService } from '../../incidents/services/IncidentService';
import { buildIncidentAnalysisMessages } from '../prompts/incidentAnalysisPrompt';
import { GroqClient } from './GroqClient';

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
  model: string
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
  };
}

/**
 * Análise sob demanda de incidente.
 * Isolado: lê via IncidentService (read-only) e NÃO altera status/banco.
 */
export class IncidentAnalyzerService {
  constructor(
    private readonly incidents: IncidentService,
    private readonly groq = new GroqClient()
  ) {}

  getStatus(): { enabled: boolean; model: string | null } {
    return {
      enabled: this.groq.isEnabled(),
      model: this.groq.isEnabled() ? env.groqModel : null,
    };
  }

  async analyze(userId: string, incidentId: string): Promise<IncidentAiAnalysis> {
    if (!this.groq.isEnabled()) {
      throw new AppError(
        'INTERNAL_ERROR',
        'IA desabilitada. Defina GROQ_API_KEY no servidor.',
        503
      );
    }

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

    return normalize(detail.id, parsed, env.groqModel);
  }
}
