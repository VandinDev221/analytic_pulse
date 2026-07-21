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

Próximo: **Fase 1 — Monitoring** (protocolos e timings além de HTTP).

---

## Fase 1 — Monitoring

Expandir o monitoramento além de HTTP simples.

| Capacidade | Detalhe |
|------------|---------|
| Protocolos | HTTP, HTTPS, TCP, PING, DNS, SSL, Port |
| Validações | Keyword, Header, Response, Body, JSON |
| Timing | DNS, TCP, TLS, TTFB, Download, Total |
| Metadados | Response Size, Status Code, Headers, Redirect Chain, Content Length |
| Histórico | Response History persistido |

---

## Fase 2 — Incident System

Sistema profissional de incidentes.

**Campos:** UUID, Status, Opened At, Recovered At, Duration, Affected Services, Severity, Root Cause, Notes, Timeline, Acknowledged By, Resolved By, Tags, Comentários, Histórico completo.

**Timeline (estilo GitHub):**

```
14:00  Latency Increased
  ↓
14:03  API Timeout
  ↓
14:04  Telegram Alert
  ↓
14:06  Incident Opened
  ↓
14:12  Recovered
  ↓
14:13  AI Analysis
```

---

## Fase 3 — Alert Engine

Canais: Telegram, Discord, Slack, Webhook, Email, Microsoft Teams, Push.

Por alerta: Retry, Cooldown, Escalonamento, Prioridade, Regras.

```
IF Latency > 500ms FOR 5 min
THEN Telegram + Slack + Webhook
```

---

## Fase 4 — Status Pages

Dark mode, histórico, incidentes, calendário de manutenção, SLA, tempo médio, assinatura de notificações, RSS, webhook, domínio personalizado, tema customizado.

---

## Fase 5 — Dashboard

Redesenho completo. Referências: Stripe, Linear, Cloudflare, Vercel, Grafana, Datadog.

Cards inteligentes, heatmaps, timeline, mapas, top latências, top incidentes, disponibilidade, SLA, performance, uso diário/semanal/mensal.

Ver [UI_GUIDELINES.md](./UI_GUIDELINES.md).

---

## Fase 6 — Mapa Mundial

Mapa interativo: nós, latência, serviços, heartbeat, animações suaves.

---

## Fase 7 — Analytics

Média, P95, P99, latência, disponibilidade, MTTR, MTBF, gráficos profissionais.

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
