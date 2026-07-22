import type { IncidentDetail } from '@analytic-pulse/shared';
import type { GroqChatMessage } from '../services/GroqClient';

/** Prompt puro (sem I/O) para análise sob demanda de incidente. */
export function buildIncidentAnalysisMessages(
  detail: IncidentDetail
): GroqChatMessage[] {
  const monitors = detail.affected_monitors
    .map((m) => `- ${m.name} (${m.id}) status=${m.status}`)
    .join('\n');

  const timeline = detail.timeline
    .slice(-20)
    .map(
      (e) =>
        `- [${e.created_at}] ${e.event_type}: ${e.message}`
    )
    .join('\n');

  const comments = detail.comments
    .slice(-10)
    .map((c) => `- [${c.created_at}] ${c.body}`)
    .join('\n');

  const system = `Você é um analista sênior de SRE ajudando a investigar um incidente de uptime.
Responda SEMPRE em português brasileiro.
Você NÃO executa ações — só sugere hipóteses e próximos passos.
Toda hipótese e toda ação DEVEM ter um campo "explanation" curto (por quê).
Não invente métricas ou eventos que não estejam no contexto.
Retorne APENAS um JSON válido com o schema:
{
  "summary": "string",
  "possible_causes": [{ "text": "string", "explanation": "string" }],
  "suggested_actions": [{ "text": "string", "explanation": "string", "risk": "low|medium|high" }],
  "explanation": "string"
}`;

  const user = `Analise o incidente abaixo.

ID: ${detail.id}
Título: ${detail.title}
Status: ${detail.status}
Severidade: ${detail.severity}
Aberto em: ${detail.opened_at}
Duração (ms): ${detail.duration_ms}
Root cause atual: ${detail.root_cause || '(vazio)'}
Notas: ${detail.notes || '(vazio)'}
Tags: ${detail.tags.join(', ') || '(nenhuma)'}

Monitores afetados:
${monitors || '(nenhum)'}

Timeline (recente):
${timeline || '(vazia)'}

Comentários:
${comments || '(nenhum)'}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
