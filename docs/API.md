# Analytic Pulse — API pública

REST versionada em `/api/v1`. OpenAPI em `/api/openapi.json` e Swagger UI em `/api/docs`.

## Autenticação

1. No dashboard, abra **API** (`/api-keys`) e crie uma chave.
2. Copie o token `ap_pk_…` (exibido só uma vez).
3. Envie em cada request:

```bash
curl -H "Authorization: Bearer ap_pk_SEU_TOKEN" \
  https://SUA_API/api/v1/monitors
```

Alternativa: header `X-Api-Key: ap_pk_SEU_TOKEN`.

Scopes: `read` (consultas) e `write` (criar/atualizar/apagar). `write` implica `read`.

Gerenciamento das chaves (JWT do dashboard):

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/api/api-keys` | Listar |
| POST | `/api/api-keys` | Criar (`{ "name": "ci" }`) |
| DELETE | `/api/api-keys/:id` | Revogar |

## Endpoints `/api/v1`

| Método | Path | Scope |
|--------|------|-------|
| GET | `/monitors` | read |
| GET | `/monitors/:id` | read |
| GET | `/monitors/:id/metrics` | read |
| POST | `/monitors` | write |
| PATCH | `/monitors/:id` | write |
| DELETE | `/monitors/:id` | write |
| GET | `/incidents?status=active` | read |
| GET | `/incidents/:id` | read |
| GET | `/dashboard/overview` | read |
| GET | `/analytics/overview?range=7d` | read |
| GET | `/ssl/overview` | read |
| GET | `/dns/overview` | read |
| GET | `/map/overview` | read |
| GET | `/agents` | read |
| GET | `/agents/:id` | read |
| GET | `/docker/overview` | read |
| GET | `/kubernetes/overview` | read |

Migration: [`database/migration_public_api_v1.sql`](../database/migration_public_api_v1.sql).

GraphQL e SDKs ficam para fases seguintes — os use cases já são reutilizáveis via services.
