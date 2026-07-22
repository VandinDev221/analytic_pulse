# Analytic Pulse — Roadmap

Trabalho em **épicos**. Cada fase gera um prompt/PR específico. Nunca implementar várias fases grandes de uma vez.

Legenda: `⬜` planejado · `🔄` em andamento · `✅` concluído

---

## Fase 0 — Fundação (pré-requisito)

`✅` Documentação de visão, arquitetura e guidelines  
`✅` Estrutura de monorepo orientada a serviços (`apps/` + `packages/`)  
`✅` Design System base (`packages/ui`)  
`✅` Service + Repository Pattern no backend (módulo `monitoring` como piloto)  
`✅` Observabilidade interna (logs estruturados, `/health`, `/metrics`)

Próximo: **Fase 15 — CLI**.

---

## Fase 1 — Monitoring

`✅` Protocolos: HTTP, HTTPS, TCP, Port, PING, DNS, SSL  
`✅` Validações: Keyword, Header, JSON path/value, status codes  
`✅` Timings: DNS, TCP, TLS, TTFB, Download, Total  
`✅` Metadados: Response Size, Status Code, Headers, Redirect Chain  
`✅` Histórico enriquecido em `ping_logs`

Migration: [`database/migration_monitoring_v1.sql`](../database/migration_monitoring_v1.sql)

---

## Fase 2 — Incident System

`✅` Modelo completo (status, severity, root cause, notes, tags, duration)  
`✅` Serviços afetados (`incident_monitors`)  
`✅` Timeline estilo GitHub (`incident_timeline_events`)  
`✅` Comentários e acknowledge/resolve  
`✅` Abertura/resolução automática no CheckOrchestrator  

Migration: [`database/migration_incidents_v1.sql`](../database/migration_incidents_v1.sql)

---

## Fase 3 — Alert Engine

`✅` Canais: Telegram, WhatsApp, Email, Slack, Discord, Teams, Webhook  
`✅` Regras: IF metric op threshold FOR N seconds THEN channels  
`✅` Cooldown, retry com backoff, escalonamento por step  
`✅` Entregas (`alert_deliveries`) + UI `/alerts`  
`✅` Fallback legado (`notification_settings`) se não houver regras  

Migration: [`database/migration_alerts_v1.sql`](../database/migration_alerts_v1.sql)

---

## Fase 4 — Status Pages

`✅` Dark/Light mode + tema customizado (accent, logo)  
`✅` Histórico, incidentes públicos, calendário de manutenção  
`✅` SLA target, uptime médio, latência, MTTR  
`✅` Assinatura por e-mail + RSS  
`✅` Webhook + domínio personalizado (campo)  
`✅` Painel `/status-page` para configuração  

Migration: [`database/migration_status_pages_v1.sql`](../database/migration_status_pages_v1.sql)

---

## Fase 5 — Dashboard

`✅` Cards inteligentes (contexto + tendência)  
`✅` Heatmap de uptime (90d)  
`✅` Timeline de eventos  
`✅` Top latências / top incidentes  
`✅` Disponibilidade, SLA, MTTR, performance  
`✅` Uso diário / semanal / mensal  
`✅` API `GET /api/dashboard/overview`  

Referências: Stripe, Linear, Cloudflare, Vercel, Grafana, Datadog.  
Ver [UI_GUIDELINES.md](./UI_GUIDELINES.md).

---

## Fase 6 — Mapa Mundial

`✅` Mapa interativo (Equal Earth + landmass)  
`✅` Nós por serviço com status e latência  
`✅` Heartbeat animado + links entre regiões  
`✅` Catálogo `map_regions` + `monitors.region_code`  
`✅` Página `/map` + API `GET /api/map/overview`  

Migration: [`database/migration_map_v1.sql`](../database/migration_map_v1.sql)

---

## Fase 7 — Analytics

`✅` Média, P50, P95, P99 de latência  
`✅` Disponibilidade (uptime)  
`✅` MTTR e MTBF  
`✅` Séries temporais + tabela por monitor  
`✅` Ranges 7d / 30d / 90d · página `/analytics`  
`✅` API `GET /api/analytics/overview`  

Migration: [`database/migration_analytics_v1.sql`](../database/migration_analytics_v1.sql)

---

## Fase 8 — SSL

`✅` Validade, issuer, subject, fingerprint  
`✅` Dias restantes, cipher, versão TLS  
`✅` Limiar de renovação (`ssl_warn_days`) + aviso automático (24h)  
`✅` Métrica de alerta `ssl_days_remaining`  
`✅` Página `/ssl` + detalhe no monitor  
`✅` API `GET /api/ssl/overview`  

Migration: [`database/migration_ssl_v1.sql`](../database/migration_ssl_v1.sql)

---

## Fase 9 — DNS

`✅` Tipos: A, AAAA, MX, TXT, CNAME, NS, SPF, DKIM, DMARC, DNSSEC  
`✅` Snapshot persistido + histórico `dns_meta`  
`✅` Scan completo de domínio (email auth)  
`✅` Página `/dns` + detalhe no monitor  
`✅` API `GET /api/dns/overview` e `GET /api/dns/scan`  

Migration: [`database/migration_dns_v1.sql`](../database/migration_dns_v1.sql)

---

## Fase 10 — Linux Agent

`✅` Collector `apps/agent` (CPU, RAM, Swap, Disco, Temp, Rede)  
`✅` Containers Docker, serviços systemd, journal logs  
`✅` Tokens de ingestão + snapshots (7d)  
`✅` Páginas `/agents` e `/agents/:id`  
`✅` API `POST /api/agents/ingest`, CRUD `/api/agents`  

Migration: [`database/migration_agents_v1.sql`](../database/migration_agents_v1.sql)  
Docs: [`apps/agent/README.md`](../apps/agent/README.md)

---

## Fase 11 — Docker

`✅` Coleta enriquecida no agent (`docker` snapshot: stats, volumes, networks, logs)  
`✅` API `GET /api/docker/overview` agregando hosts  
`✅` Página `/docker` (containers, volumes, networks, logs)  
`✅` Detalhe do agent com métricas Docker  

Sem migration — dados vêm de `agents.latest_metrics`.

---

## Fase 12 — Kubernetes

`✅` Coleta no agent via `kubectl` (pods, deployments, services, ingress, nodes, namespaces, pvc)  
`✅` API `GET /api/kubernetes/overview` agregando hosts  
`✅` Página `/kubernetes` com filtros por host/namespace  
`✅` Detalhe do agent com resumo do cluster  

Sem migration — dados vêm de `agents.latest_metrics.kubernetes`.

---

## Fase 13 — API pública

`✅` Chaves `ap_pk_…` (`api_keys`) + CRUD JWT em `/api/api-keys`  
`✅` REST versionada `/api/v1` (monitors, incidents, overviews, agents, docker, k8s)  
`✅` OpenAPI 3 + Swagger UI em `/api/docs` (`/api/openapi.json`)  
`✅` Página `/api-keys` no dashboard  

Migration: [`database/migration_public_api_v1.sql`](../database/migration_public_api_v1.sql)  
Docs: [`docs/API.md`](API.md)

---

## Fase 14 — SDKs

`✅` TypeScript/JavaScript — `@analytic-pulse/sdk` (`packages/sdk`)  
`✅` Python — `analytic-pulse` (`sdks/python`)  
`✅` Go — `sdks/go`  
`⬜` PHP / Java / C# / Rust — scaffolds com exemplos HTTP  

Docs: [`docs/SDKS.md`](SDKS.md)

---

## Fase 15 — CLI

```
pulse login
pulse monitor create
pulse status
pulse incidents
pulse ssl
pulse deploy
```

---

## Fase 16 — AI (módulo isolado)

Nunca misturar IA com regras de negócio.

`✅` Assistente de ajuda no dashboard (widget) via Groq (`POST /api/ai/chat`)  
`⬜` Resumo automático, análise, correlação de incidentes, root cause, sugestões, predição, detecção de padrões

Toda sugestão deve possuir **explicação**. O sistema funciona sem IA.

---

## Como avançar

1. Escolher **uma** fase (ou um slice vertical dela).
2. Abrir issue/épico com escopo fechado.
3. Implementar respeitando [ARCHITECTURE.md](./ARCHITECTURE.md) e [UI_GUIDELINES.md](./UI_GUIDELINES.md).
4. PR pequeno, revisável, com testes.
5. Só então iniciar a próxima fase.
