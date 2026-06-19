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
| **Cron Job** | `analytic-pulse-cron` | Pings automáticos a cada minuto |

### Passo a passo

#### 1. Conectar o repositório

1. Acesse [dashboard.render.com](https://dashboard.render.com).
2. **New** → **Blueprint**.
3. Conecte o repositório `VandinDev221/analytic_pulse`.
4. O Render lê o arquivo [`render.yaml`](render.yaml) e provisiona os 4 recursos.
5. Aguarde o primeiro deploy (pode levar alguns minutos).

#### 2. Criar as tabelas no banco

1. No dashboard Render, abra **analytic-pulse-db**.
2. Vá em **Connect** → abra o **PSQL** ou **External connection**.
3. Cole e execute o conteúdo de [`database/schema.sql`](database/schema.sql).

#### 3. Validar

| Teste | URL |
|-------|-----|
| Health da API | `https://analytic-pulse-api.onrender.com/health` |
| Frontend | `https://analytic-pulse-web.onrender.com` |
| Cron (logs) | Render → **analytic-pulse-cron** → **Logs** |

Crie uma conta no frontend, adicione um monitor e aguarde ~1 minuto para o primeiro ping.

#### 4. Telegram (opcional)

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
| `NODE_ENV` | `production` |

Para ver os segredos: Render → **analytic-pulse-api** → **Environment**.

---

## Arquitetura

```
Usuários → analytic-pulse-web.onrender.com (SPA)
                │ rewrite /api/*
                ▼
           analytic-pulse-api.onrender.com (Express)
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
 Postgres    Telegram   Cron Job (1 min)
```

O frontend chama `/api` no mesmo domínio — o Render faz proxy para a API. Sem configuração extra de CORS no browser.

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

- **API**: entra em sleep após ~15 min sem tráfego; o cron acorda a cada minuto.
- **Postgres free**: expira em 90 dias (migre para Neon ou plano pago antes).
- **Cron**: 1 execução por minuto no free tier.

Para produção séria sem sleep, use plano **Starter** na API (~$7/mês).

---

## Licença

MIT — veja [LICENSE](LICENSE).
