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
| [docs/API.md](docs/API.md) | API pública REST `/api/v1` + OpenAPI |
| [docs/SDKS.md](docs/SDKS.md) | SDKs oficiais (TS, Python, Go, …) |
| [docs/CLI.md](docs/CLI.md) | CLI `pulse` |
| [docs/AI.md](docs/AI.md) | Módulo de IA isolado (chat + análise) |

> Implementar o roadmap em fatias. Evite big-bang de várias fases no mesmo PR.

## Estrutura do monorepo

```
apps/
  api/          # API Express (@analytic-pulse/api)
  web/          # Dashboard React (@analytic-pulse/web)
  agent/        # Collector Linux
  cli/          # CLI oficial (`pulse`)
packages/
  shared/       # Tipos e erros compartilhados
  ui/           # Design System base
  sdk/          # SDK TypeScript/JS (@analytic-pulse/sdk)
sdks/
  python/ go/ php/ java/ csharp/ rust/
database/       # schema.sql e migrations
docs/           # Visão, roadmap, arquitetura, API, SDKs, CLI
```

### Desenvolvimento local

```bash
npm install
npm run build:shared   # necessário antes da API em dev
npm run dev:api        # http://localhost:3001
npm run dev:web        # http://localhost:5173
```

---

## Deploy em produção (Gratuito e Otimizado)

Para garantir hospedagem estável e **100% gratuita** sem estourar limites de horas do Render, dividimos os recursos da seguinte forma:

| Recurso | Hospedagem | Função | Plano |
|---------|------------|--------|-------|
| **Web Service** | Render | API Express (`analytic-pulse-api`) | Free (apenas 1 serviço ativo, consome < 720h/m) |
| **Static Site** | [Vercel](https://vercel.com) | Frontend React | Free (100% grátis, sem cold start) |
| **PostgreSQL** | [Neon](https://neon.tech) | Banco de dados | Free (sem expiração de 90 dias do Render) |
| **cron-job.org** | Externo | Pings a cada minuto e Keep-Alive da API | Free (evita que a API durma) |

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
   Para a Fase 10 (Linux Agent), execute [`database/migration_agents_v1.sql`](database/migration_agents_v1.sql).
   A Fase 11 (Docker) não exige migration — agrega snapshots dos agents.
   A Fase 12 (Kubernetes) idem — agrega `kubectl` via agents (`/kubernetes`).
   Para a Fase 13 (API pública), execute [`database/migration_public_api_v1.sql`](database/migration_public_api_v1.sql).
   Para a Fase 23 (Vigia), execute [`database/migration_vigia_v1.sql`](database/migration_vigia_v1.sql).
   Docs da API: [`docs/API.md`](docs/API.md) · Swagger: `/api/docs`.
   SDKs: [`docs/SDKS.md`](docs/SDKS.md) (`packages/sdk`, `sdks/python`, `sdks/go`).

### Browser checks (Playwright)

```bash
npm run playwright:install -w @analytic-pulse/api
# opcional: PLAYWRIGHT_ENABLED=false  PLAYWRIGHT_TIMEOUT_MS=30000
```

No dashboard, crie um monitor com tipo **Browser (Playwright)** e URL `https://…`.  
O campo seletor CSS (opcional) deve ficar visível para o check passar.

### Linux Agent

Ver [`apps/agent/README.md`](apps/agent/README.md). Crie um agent em `/agents`, copie o token e rode:

```bash
cd apps/agent && npm run build
PULSE_API_URL=https://sua-api PULSE_AGENT_TOKEN=ap_agent_... npm start
```

Com Docker no host, o agent (v0.2+) envia containers, CPU/RAM, restarts, volumes, networks e logs — visíveis em `/docker`.

Com `kubectl` configurado no host, o agent (v0.3+) envia o snapshot do cluster — visível em `/kubernetes`.

### Probes regionais

1. Execute [`database/migration_probes_v1.sql`](database/migration_probes_v1.sql).
2. Em `/agents`, crie um agent tipo **Probe** e escolha a região (ex.: `iad`).
3. No servidor daquela região:

```bash
cd apps/agent && npm run build
export PULSE_API_URL=https://sua-api
export PULSE_AGENT_TOKEN=ap_agent_...
export PULSE_AGENT_MODE=probe
npm start
```

Monitores com `region_code` igual à do probe passam a ser checados por ele. Sem probe online, a API executa e grava `DEFAULT_PROBE_REGION` (padrão `gru`).

### OpenTelemetry

A API exporta traces e metrics via OTLP HTTP quando `OTEL_EXPORTER_OTLP_ENDPOINT` está definido (Grafana Cloud, Jaeger, New Relic, Collector local, etc.).

```bash
# apps/api/.env
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=analytic-pulse-api
```

- Spans HTTP/Express/Postgres (auto) + `monitoring.ping_cycle` / `monitoring.check`
- Contadores `pulse.*` alinhados a `GET /metrics`
- Logs JSON incluem `trace_id` / `span_id` quando há span ativo
- Sem endpoint: SDK fica desligado (zero overhead de export)

### Real User Monitoring (RUM)

1. Execute [`database/migration_rum_v1.sql`](database/migration_rum_v1.sql).
2. No dashboard → **RUM**, crie um site e copie o token `ap_rum_…`.
3. No frontend do cliente:

```bash
npm install @analytic-pulse/rum
```

```ts
import { init } from '@analytic-pulse/rum';

init({
  endpoint: 'https://sua-api',
  token: 'ap_rum_...',
});
```

Coleta page views, Web Vitals (LCP/INP/CLS/FCP/TTFB) e erros de browser. Ingest: `POST /api/rum/ingest`.

### SDKs (API pública)

```bash
# TypeScript
npm run build -w @analytic-pulse/sdk

# Python
cd sdks/python && pip install -e .

# Go
cd sdks/go && go test ./...
```

Crie uma chave em `/api-keys` e veja [`docs/SDKS.md`](docs/SDKS.md).

### CLI

```bash
npm run build:cli
npx pulse login --api-url https://sua-api --api-key ap_pk_...
npx pulse status
```

Docs: [`docs/CLI.md`](docs/CLI.md).


**Opção B — Neon (recomendado se já tem Postgres no Render)**

1. Crie um projeto em [neon.tech](https://neon.tech) (grátis, sem limite do Render).
2. SQL Editor → execute [`database/schema.sql`](database/schema.sql).
3. Copie a connection string (`postgresql://...?sslmode=require`).

**Opção C — Apagar o Postgres antigo no Render**

1. Delete o banco free não utilizado no Render.
2. Crie um novo Postgres manualmente e rode o `schema.sql`.

#### 2. Blueprint (Render — apenas API)

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint** (ou **Manual sync** no blueprint existente).
2. Repositório `VandinDev221/analytic_pulse`, branch `main`.
3. Quando pedir **`DATABASE_URL`**, **`POSTGRES_URL`** e **`API_PUBLIC_URL`**, preencha os valores (no caso da API_PUBLIC_URL, coloque a URL da API que o Render gerar para você no novo serviço).
4. Aguarde criar `analytic-pulse-api`. (O frontend `analytic-pulse-web` foi removido do render.yaml para não consumir horas grátis).

#### 3. Conferir variáveis da API

Render → **analytic-pulse-api** → **Environment**:

| Variável | Deve conter |
|----------|-------------|
| `DATABASE_URL` | Connection string do Postgres (Neon) |
| `POSTGRES_URL` | Igual ao `DATABASE_URL` |
| `API_PUBLIC_URL` | URL pública da própria API no Render |
| `JWT_SECRET` | Gerado automaticamente |
| `CRON_SECRET` | Gerado automaticamente (use no cron-job.org) |
| `FRONTEND_URL` | URL do frontend na Vercel (ex: `https://seu-app.vercel.app`) |

---

## Deploy do Frontend na Vercel

1. Importe o repositório na [Vercel](https://vercel.com).
2. Em **Project Settings**:
   - **Root Directory:** selecione `apps/web`.
   - **Framework Preset:** `Vite` (deve ser detectado automaticamente).
3. Em **Build & Development Settings**:
   - Marque a caixa de seleção para customizar os comandos se necessário:
   - **Install Command:** `cd ../.. && npm install`
   - **Build Command:** `cd ../.. && npm run build:web`
   - **Output Directory:** `dist`
4. Em **Environment Variables**:
   | Variável | Valor |
   |----------|-------|
   | `VITE_API_URL` | URL da sua API no Render (ex: `https://analytic-pulse-api.onrender.com`) |
5. Clique em **Deploy**.
6. Pegue a URL do projeto gerada pela Vercel e configure-a na variável `FRONTEND_URL` da sua API no Render, efetuando um novo deploy da API para aplicar o CORS correto.

---

#### 4. Cron de pings (Keep-Alive da API)

1. Copie o valor de `CRON_SECRET` da API no Render.
2. [cron-job.org](https://cron-job.org) → crie um novo job:
   - **URL:** `https://sua-api-render.onrender.com/api/cron/ping`
   - **Intervalo:** a cada 1 minuto (garante que a API execute os pings de monitoramento e **não entre em modo sleep**).
   - **Header:** chave `x-cron-secret` = valor do seu `CRON_SECRET`

#### 5. Validar

| Teste | URL |
|-------|-----|
| Health | `https://sua-api-render.onrender.com/health` |
| Health DB | `https://sua-api-render.onrender.com/health/db` |
| App (Frontend) | `https://seu-app.vercel.app` |

---

## Erro comum no Blueprint

```
Create database analytic-pulse-db
(cannot have more than one active free tier database)
```

**Causa:** Seu workspace do Render já possui um Postgres gratuito ativo.  
**Solução:** O `render.yaml` do projeto está configurado para **não criar banco** de dados automaticamente. Reutilize o banco existente ou crie uma conta gratuita no [Neon.tech](https://neon.tech) e forneça a URL de conexão nos campos `DATABASE_URL` y `POSTGRES_URL` ao executar o blueprint.

---

## Plano gratuito — limitações

- **API**: sleep após ~15 min — cron-job.org acorda a cada minuto.
- **Postgres Render free**: 1 por workspace, expira em 90 dias.
- **Neon free**: alternativa sem limite do Render.

---

## Licença

MIT — veja [LICENSE](LICENSE).
