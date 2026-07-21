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

Próximo: **Fase 8 — SSL**.

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

Validade, issuer, dias restantes, cipher, versão TLS, renovação, alertas automáticos.

---

## Fase 9 — DNS

A, AAAA, MX, TXT, CNAME, NS, SPF, DKIM, DMARC, DNSSEC.

---

## Fase 10 — Linux Agent

CPU, RAM, Swap, Disco, Temperatura, Rede, Containers, Serviços, Logs.

---

## Fase 11 — Docker

Containers, CPU, RAM, Restart, Volumes, Network, Logs.

---

## Fase 12 — Kubernetes

Pods, Deployments, Ingress, Nodes, Namespaces, Services, PVC.

---

## Fase 13 — API pública

REST primeiro; arquitetura preparada para GraphQL. OpenAPI / Swagger. Documentação automática. Toda funcionalidade exposta via API.

---

## Fase 14 — SDKs

JavaScript, TypeScript, Python, Go, PHP, Java, C#, Rust.

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

Inicialmente: resumo automático, análise, correlação de incidentes, root cause, sugestões, predição, detecção de padrões.

Toda sugestão deve possuir **explicação**. O sistema funciona sem IA.

---

## Como avançar

1. Escolher **uma** fase (ou um slice vertical dela).
2. Abrir issue/épico com escopo fechado.
3. Implementar respeitando [ARCHITECTURE.md](./ARCHITECTURE.md) e [UI_GUIDELINES.md](./UI_GUIDELINES.md).
4. PR pequeno, revisável, com testes.
5. Só então iniciar a próxima fase.
