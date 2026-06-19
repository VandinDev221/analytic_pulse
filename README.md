# Analytic Pulse

**Analytic Pulse** é um monitor de uptime open-source inspirado em plataformas como *Uptime Kuma* e *Statuspage.io*. Permite monitorar a disponibilidade de URLs/APIs, registrar latência em gráficos interativos, exibir status em uma página pública com grid de 90 dias (estilo contribuições do GitHub) e enviar alertas automáticos para o Telegram.

Repositório: [github.com/VandinDev221/analytic_pulse](https://github.com/VandinDev221/analytic_pulse)

---

## Estrutura do projeto

```
analytic_pulse/
├── backend/          # API Node.js + Express + TypeScript + Supabase
├── frontend/         # SPA React + Vite + TypeScript + Tailwind CSS
├── database/         # Schema PostgreSQL para Supabase
├── package.json      # Scripts do monorepo
└── README.md
```

| Pasta | Descrição |
|-------|-----------|
| `backend/` | API que executa pings em lotes, persiste histórico e dispara alertas |
| `frontend/` | Dashboard, páginas de status públicas e gráficos (Recharts) |
| `database/` | Script SQL do schema (`schema.sql`) |

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) 18+
- Conta gratuita no [Supabase](https://supabase.com)

---

## Configuração

### 1. Banco de dados (Supabase)

1. Crie um projeto no [Supabase](https://supabase.com).
2. Em **SQL Editor** → **New Query**, cole o conteúdo de [`database/schema.sql`](database/schema.sql) e execute.
3. Em **Project Settings** → **API**, anote:
   - `Project URL`
   - `anon public` key
   - `service_role` key (usada no backend para operações em background)

### 2. Variáveis de ambiente

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env
```

Preencha os arquivos `.env` com suas credenciais do Supabase.

| Variável | Onde |
|----------|------|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` | `backend/.env` |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | `frontend/.env` |

### 3. Instalação e execução

```bash
# Instalar dependências (raiz do projeto)
npm run install:all

# Terminal 1 — backend (http://localhost:3001)
npm run dev:backend

# Terminal 2 — frontend (http://localhost:5173)
npm run dev:frontend
```

Ou manualmente em cada pasta:

```bash
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

---

## Alertas no Telegram

1. Crie um bot com o [@BotFather](https://t.me/BotFather) e guarde o **token**.
2. Obtenha seu **Chat ID** (ex.: [@userinfobot](https://t.me/userinfobot) ou `getUpdates` da API do Telegram).
3. No dashboard, aba **Notificações**, informe token e chat ID e ative os alertas.

---

## Cron job (pings automáticos)

**Desenvolvimento** — dispare manualmente:

```
GET http://localhost:3001/api/cron/ping
```

**Produção** — agende a cada minuto (ex.: [cron-job.org](https://cron-job.org)) apontando para:

```
GET https://seu-backend.com/api/cron/ping
Header: x-cron-secret: <valor de CRON_SECRET no .env>
```

---

## Build para produção

```bash
npm run build
```

- Backend compilado em `backend/dist/`
- Frontend compilado em `frontend/dist/`

---

## Licença

MIT — veja [LICENSE](LICENSE).
