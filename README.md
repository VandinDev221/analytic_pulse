# Analytic Pulse

Monitor de uptime open-source em evolução para plataforma completa de **observabilidade**: disponibilidade de URLs/APIs, gráficos de latência, status page pública e alertas via Telegram.

Repositório: [github.com/VandinDev221/analytic_pulse](https://github.com/VandinDev221/analytic_pulse)

## Documentação do produto

| Documento | Conteúdo |
|-----------|----------|
| [docs/VISION.md](docs/VISION.md) | Missão, princípios e destino do produto |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Fases (Monitoring → AI) — trabalhar um épico por vez |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Monorepo, Clean Architecture, Services + Repositories |
| [docs/UI_GUIDELINES.md](docs/UI_GUIDELINES.md) | Design System, UX e anti-padrões |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Como contribuir sem dívida técnica |

> Implementar o roadmap em fatias. Evite big-bang de várias fases no mesmo PR.

## Estrutura do monorepo

```
apps/
  api/          # API Express (@analytic-pulse/api)
  web/          # Dashboard React (@analytic-pulse/web)
packages/
  shared/       # Tipos e erros compartilhados
  ui/           # Design System base
database/       # schema.sql e migrations
docs/           # Visão, roadmap, arquitetura
```

### Desenvolvimento local

```bash
npm install
npm run build:shared   # necessário antes da API em dev
npm run dev:api        # http://localhost:3001
npm run dev:web        # http://localhost:5173
```

---

## Deploy em produção (Render)

O Blueprint cria **API + frontend**. O banco Postgres é **externo** (você informa a connection string).

| Recurso | Nome | Função |
|---------|------|--------|
| **Web Service** | `analytic-pulse-api` | API Express |
| **Static Site** | `analytic-pulse-web` | Frontend React |
| **PostgreSQL** | (seu banco) | Render existente ou [Neon](https://neon.tech) |
| **cron-job.org** | (externo) | Pings a cada minuto |

### Passo a passo

#### 1. Banco de dados (antes do Blueprint)

O Render permite **apenas 1 Postgres gratuito** por workspace. Escolha uma opção:

**Opção A — Reutilizar o Postgres que você já tem no Render**

1. Render → seu banco existente → **Connect** → copie a **Internal Database URL**.
2. Abra o **PSQL** e execute [`database/schema.sql`](database/schema.sql).
   Se o banco já existia antes da Fase 1, execute também [`database/migration_monitoring_v1.sql`](database/migration_monitoring_v1.sql).
   Para a Fase 2 (incidentes), execute [`database/migration_incidents_v1.sql`](database/migration_incidents_v1.sql).
   Para a Fase 3 (Alert Engine), execute [`database/migration_alerts_v1.sql`](database/migration_alerts_v1.sql).
   Para a Fase 4 (Status Pages), execute [`database/migration_status_pages_v1.sql`](database/migration_status_pages_v1.sql).
   Para a Fase 6 (Mapa Mundial), execute [`database/migration_map_v1.sql`](database/migration_map_v1.sql).
   Para a Fase 7 (Analytics), execute [`database/migration_analytics_v1.sql`](database/migration_analytics_v1.sql).
   Para a Fase 8 (SSL), execute [`database/migration_ssl_v1.sql`](database/migration_ssl_v1.sql).
   Para a Fase 9 (DNS), execute [`database/migration_dns_v1.sql`](database/migration_dns_v1.sql).

**Opção B — Neon (recomendado se já tem Postgres no Render)**

1. Crie um projeto em [neon.tech](https://neon.tech) (grátis, sem limite do Render).
2. SQL Editor → execute [`database/schema.sql`](database/schema.sql).
3. Copie a connection string (`postgresql://...?sslmode=require`).

**Opção C — Apagar o Postgres antigo no Render**

1. Delete o banco free não utilizado no Render.
2. Crie um novo Postgres manualmente e rode o `schema.sql`.

#### 2. Blueprint

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint** (ou **Manual sync** no blueprint existente).
2. Repositório `VandinDev221/analytic_pulse`, branch `main`.
3. Quando pedir **`DATABASE_URL`** e **`POSTGRES_URL`**, cole a **mesma** connection string nos dois campos.
4. Aguarde criar `analytic-pulse-api` e `analytic-pulse-web`.

#### 3. Conferir variáveis

Render → **analytic-pulse-api** → **Environment**:

| Variável | Deve conter |
|----------|-------------|
| `DATABASE_URL` | Connection string do Postgres |
| `POSTGRES_URL` | Igual ao `DATABASE_URL` |
| `JWT_SECRET` | Gerado automaticamente |
| `CRON_SECRET` | Gerado automaticamente |
| `FRONTEND_URL` | URL(s) do frontend, separadas por vírgula se houver mais de uma |

Exemplo com Vercel + Render:
```
FRONTEND_URL=https://analytic-pulse.vercel.app,https://analytic-pulse-web.onrender.com
```

Render → **analytic-pulse-web** → **Environment**:

| Variável | Deve conter |
|----------|-------------|
| `VITE_API_URL` | `https://analytic-pulse-api.onrender.com` |

Se `VITE_API_URL` estiver vazio, adicione manualmente e faça **Manual Deploy** no frontend.

---

## Frontend na Vercel

1. Importe o repo na [Vercel](https://vercel.com) com **Root Directory** = `apps/web`.
2. Em **Settings → General / Build & Development**:
   - **Install Command:** `cd ../.. && npm install`
   - **Build Command:** `cd ../.. && npm run build:web`
   - **Output Directory:** `dist` (relativo a `apps/web`)
3. **Environment Variables:**
   | Variável | Valor |
   |----------|-------|
   | `VITE_API_URL` | `https://analytic-pulse-api.onrender.com` |
4. Deploy.

5. Na API (Render) → **Environment** → atualize `FRONTEND_URL`:
   ```
   https://analytic-pulse.vercel.app
   ```
   Ou várias origens separadas por vírgula se usar Vercel e Render ao mesmo tempo.

6. **Redeploy** da API após alterar `FRONTEND_URL`.

---

#### 4. Cron de pings

1. Copie `CRON_SECRET` da API.
2. [cron-job.org](https://cron-job.org) → novo job:
   - **URL:** `https://analytic-pulse-api.onrender.com/api/cron/ping`
   - **Intervalo:** 1 minuto
   - **Header:** `x-cron-secret` = valor do `CRON_SECRET`

#### 5. Validar

| Teste | URL |
|-------|-----|
| Health | `https://analytic-pulse-api.onrender.com/health` |
| Metrics | `https://analytic-pulse-api.onrender.com/metrics` |
| App | `https://analytic-pulse-web.onrender.com` |

---

## Erro comum no Blueprint

```
Create database analytic-pulse-db
(cannot have more than one active free tier database)
```

**Causa:** seu workspace já tem um Postgres free.  
**Solução:** o `render.yaml` atual **não cria banco** — use Neon ou o Postgres que você já tem e informe `DATABASE_URL` no sync.

---

## Plano gratuito — limitações

- **API**: sleep após ~15 min — cron-job.org acorda a cada minuto.
- **Postgres Render free**: 1 por workspace, expira em 90 dias.
- **Neon free**: alternativa sem limite do Render.

---

## Licença

MIT — veja [LICENSE](LICENSE).
