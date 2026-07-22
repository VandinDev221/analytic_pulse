# Analytic Pulse — AI (módulo isolado)

IA é **assistente**, nunca autoridade. Não altera monitores, alertas ou incidentes.

## Endpoints (`/api/ai`, JWT)

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/status` | `{ enabled, model }` — UI decide se mostra botões |
| POST | `/chat` | Assistente de ajuda do dashboard |
| POST | `/analyze-incident/:id` | Análise sob demanda (read-only) |

Rate limits: chat 20/min · análise 5/min (por usuário).

## Análise de incidente

Retorno tipado (`IncidentAiAnalysis`):

- `summary`
- `possible_causes[]` — cada item com `explanation`
- `suggested_actions[]` — `text`, `explanation`, `risk`
- `explanation` (meta)
- `disclaimer`

Sem `GROQ_API_KEY`: `/status` → `enabled: false`; análise retorna 503.

Env: `GROQ_API_KEY`, `GROQ_MODEL` (default `openai/gpt-oss-120b`).
