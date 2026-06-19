# Analytic Pulse

Monitor de uptime open-source: disponibilidade de URLs/APIs, gráficos de latência, status page pública e alertas via Telegram.

Repositório: [github.com/VandinDev221/analytic_pulse](https://github.com/VandinDev221/analytic_pulse)

---

## Deploy em produção (Render)

Stack completa via [Render Blueprint](https://render.com/docs/blueprint-spec):

| Serviço | Nome | Função |
|---------|------|--------|
| **Web Service** | `analytic-pulse-api` | API Express (pings, auth, alertas) |
| **Static Site** | `analytic-pulse-web` | Frontend React (proxy `/api` → API) |
| **PostgreSQL** | `analytic-pulse-db` | Banco de dados |
| **cron-job.org** | (externo, grátis) | Pings automáticos a cada minuto |

### Passo a passo

#### 1. Conectar o repositório

1. Acesse [dashboard.render.com](https://dashboard.render.com).
2. **New** → **Blueprint**.
3. Conecte o repositório `VandinDev221/analytic_pulse`.
4. O Render lê o arquivo [`render.yaml`](render.yaml) e provisiona API, frontend e Postgres.
5. Aguarde o primeiro deploy (pode levar alguns minutos).

#### 2. Criar as tabelas no banco

1. No dashboard Render, abra **analytic-pulse-db**.
2. Vá em **Connect** → abra o **PSQL** ou **External connection**.
3. Cole e execute o conteúdo de [`database/schema.sql`](database/schema.sql).

#### 3. Configurar pings (cron-job.org)

O Render **não oferece Cron Job gratuito** (~$1/mês mínimo). Use [cron-job.org](https://cron-job.org) (grátis):

1. Render → **analytic-pulse-api** → **Environment** → copie o valor de `CRON_SECRET`.
2. Em [cron-job.org](https://cron-job.org), crie um job:
   - **URL:** `https://analytic-pulse-api.onrender.com/api/cron/ping`
   - **Intervalo:** a cada **1 minuto**
   - **Header:** `x-cron-secret` = valor do `CRON_SECRET`
   - **Método:** GET

Isso também mantém a API acordada (free tier entra em sleep após inatividade).

#### 4. Validar

| Teste | URL |
|-------|-----|
| Health da API | `https://analytic-pulse-api.onrender.com/health` |
| Frontend | `https://analytic-pulse-web.onrender.com` |

Crie uma conta no frontend, adicione um monitor e aguarde ~1 minuto para o primeiro ping.

#### 5. Telegram (opcional)

1. Crie um bot com [@BotFather](https://t.me/BotFather).
2. Obtenha o **Chat ID** ([@userinfobot](https://t.me/userinfobot)).
3. No dashboard → aba **Notificações** → configure token e chat ID.

---

## Variáveis de ambiente (API)

Definidas automaticamente pelo `render.yaml`, exceto onde indicado:

| Variável | Origem |
|----------|--------|
| `DATABASE_URL` / `POSTGRES_URL` | Postgres `analytic-pulse-db` |
| `JWT_SECRET` | Gerado pelo Render |
| `CRON_SECRET` | Gerado pelo Render |
| `FRONTEND_URL` | URL do static site `analytic-pulse-web` |
| `VITE_API_URL` | URL da API (build do frontend) |
| `NODE_ENV` | `production` |

Para ver os segredos: Render → **analytic-pulse-api** → **Environment**.

---

## Arquitetura

```
Usuários → analytic-pulse-web.onrender.com (SPA)
                │ fetch direto (POST/GET)
                ▼
           analytic-pulse-api.onrender.com (Express)
                │
    ┌───────────┴───────────┐
    ▼                       ▼
 Postgres              cron-job.org
```

O frontend chama a API diretamente via `VITE_API_URL`. CORS é configurado com `FRONTEND_URL` na API.

---

## Estrutura do repositório

```
analytic_pulse/
├── backend/           # API Node.js + Express + PostgreSQL
├── frontend/          # SPA React + Vite + Tailwind
├── database/          # schema.sql
├── render.yaml        # Blueprint Render (produção)
└── package.json       # Scripts do monorepo
```

---

## Plano gratuito Render — limitações

- **API**: entra em sleep após ~15 min sem tráfego — o cron-job.org acorda a cada minuto.
- **Postgres free**: expira em 90 dias (migre para Neon ou plano pago antes).
- **Cron no Render**: não tem plano free; use cron-job.org ou pague ~$1/mês no Render.

Para produção sem sleep na API, use plano **Starter** (~$7/mês).

---

## Licença

MIT — veja [LICENSE](LICENSE).
