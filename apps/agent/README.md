# Analytic Pulse — Linux Agent

Collector leve (Node.js) que envia métricas do host para a API.

## Métricas

- CPU (% + load average)
- RAM / Swap
- Disco (mounts principais)
- Temperatura (thermal zones, quando disponível)
- Rede (`/proc/net/dev`)
- Containers Docker (`docker ps` / `stats` / volumes / networks / logs)
- Kubernetes (`kubectl`: pods, deployments, services, ingress, nodes, namespaces, PVC)
- Serviços systemd em execução
- Últimas linhas do `journalctl`

A partir da **v0.2.0**, o payload inclui `docker` (snapshot completo). O dashboard agrega em `/docker`.  
A partir da **v0.3.0**, inclui `kubernetes` quando o host tem `kubectl` e acesso ao cluster — agregado em `/kubernetes`.  
A partir da **v0.4.0**, modo **probe** (`PULSE_AGENT_MODE=probe`) executa checks dos monitores da região.

## Setup (host)

1. No dashboard, abra **Agents** e crie um agent **Host** — copie o token (`ap_agent_…`).
2. Rode a migration `database/migration_agents_v1.sql` (e `migration_probes_v1.sql` para probes).
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

## Setup (probe regional)

1. Crie um agent tipo **Probe** com região (ex.: `iad`).
2. No servidor daquela região:

```bash
export PULSE_AGENT_MODE=probe
export PULSE_API_URL="https://sua-api.onrender.com"
export PULSE_AGENT_TOKEN="ap_agent_..."
npm start
```

O probe busca monitores due da região e envia resultados. Monitores cobertos por probe online deixam de ser checados pela API central.

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
