# Analytic Pulse — AI (módulo isolado)

IA é **assistente**, nunca autoridade. Não altera monitores, alertas, status de incidentes nem `root_cause`.

## Endpoints (`/api/ai`, JWT)

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/status` | `{ enabled, model, auto_rca }` — UI decide se mostra botões |
| POST | `/chat` | Assistente de ajuda do dashboard |
| POST | `/analyze-incident/:id` | Análise sob demanda (persiste sugestão em `ai_analysis`) |

Rate limits: chat 20/min · análise 5/min (por usuário). Auto RCA: até 3/min por usuário, máx. 2 em paralelo.

## Análise de incidente

Retorno tipado (`IncidentAiAnalysis`), também gravado em `incidents.ai_analysis`:

- `summary`
- `possible_causes[]` — cada item com `explanation`
- `suggested_actions[]` — `text`, `explanation`, `risk`
- `explanation` (meta)
- `disclaimer`
- `trigger` — `auto` | `manual`

### RCA automática

Quando um incidente **novo** é aberto (monitor down), a API enfileira análise se:

- `GROQ_API_KEY` estiver definida
- `AI_RCA_AUTO` não for `false` (padrão: ligado)

A UI em `/incidents/:id` mostra a sugestão sem clique; o botão **Reanalisar** continua disponível.

Migration: [`database/migration_ai_rca_v1.sql`](../database/migration_ai_rca_v1.sql)

Sem `GROQ_API_KEY`: `/status` → `enabled: false`; análise retorna 503.

Env: `GROQ_API_KEY`, `GROQ_MODEL` (default `openai/gpt-oss-120b`), `AI_RCA_AUTO`.
