# Analytic Pulse — Linux Agent

Collector leve (Node.js) que envia métricas do host para a API.

## Métricas

- CPU (% + load average)
- RAM / Swap
- Disco (mounts principais)
- Temperatura (thermal zones, quando disponível)
- Rede (`/proc/net/dev`)
- Containers Docker (`docker ps`, se existir)
- Serviços systemd em execução
- Últimas linhas do `journalctl`

## Setup

1. No dashboard, abra **Agents** e crie um agent — copie o token (`ap_agent_…`).
2. Rode a migration `database/migration_agents_v1.sql`.
3. No servidor Linux:

```bash
cd apps/agent
npm install
npm run build

export PULSE_API_URL="https://sua-api.onrender.com"
export PULSE_AGENT_TOKEN="ap_agent_..."
export PULSE_AGENT_INTERVAL=30

npm start
```

## systemd (exemplo)

```ini
[Unit]
Description=Analytic Pulse Agent
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/analytic-pulse/apps/agent
Environment=PULSE_API_URL=https://sua-api.onrender.com
Environment=PULSE_AGENT_TOKEN=ap_agent_xxx
Environment=PULSE_AGENT_INTERVAL=30
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
