# Analytic Pulse — Arquitetura

## Objetivo

Arquitetura orientada a serviços em monorepo, preparada para escalar para múltiplos servidores de monitoramento, regiões, filas, workers e eventos — mesmo que inicialmente tudo rode em um único processo.

## Estrutura-alvo do monorepo

```
apps/
  web/          # Frontend (dashboard, status pages)
  api/          # API HTTP (controllers finos)

packages/
  auth/
  monitoring/
  alerts/
  analytics/
  notifications/
  incidents/
  ai/           # Isolado — nunca misturar com domínio core
  shared/       # Tipos, erros, utils, contratos
  ui/           # Design System
```

Estado atual: monorepo com `apps/api`, `apps/web`, `packages/shared` e `packages/ui`.
O módulo `monitoring` já segue Service + Repository; demais contextos migram incrementalmente.

## Camadas (Clean Architecture)

```
┌─────────────────────────────────────────┐
│  Controllers / Routes / UI              │  ← I/O apenas
├─────────────────────────────────────────┤
│  Application Services (Use Cases)       │  ← orquestração
├─────────────────────────────────────────┤
│  Domain (entities, rules, events)       │  ← regras de negócio
├─────────────────────────────────────────┤
│  Repositories (interfaces)              │  ← contratos
├─────────────────────────────────────────┤
│  Infrastructure (DB, queues, HTTP)      │  ← detalhes
└─────────────────────────────────────────┘
```

### Regras

| Permitido | Proibido |
|-----------|----------|
| Controllers chamam Services | Controllers com regra de negócio |
| Services dependem de interfaces de Repository | Módulo acessar o banco diretamente |
| Domain sem dependência de framework | Vazamento de ORM/SQL para o domínio |
| Eventos de domínio entre módulos | Dependência circular entre packages |

## Service + Repository Pattern

```ts
// Exemplo de contrato (ilustrativo)
interface MonitorRepository {
  findById(id: string): Promise<Monitor | null>;
  save(monitor: Monitor): Promise<void>;
}

class PingMonitorService {
  constructor(private readonly monitors: MonitorRepository) {}

  async executeCheck(monitorId: string): Promise<CheckResult> {
    const monitor = await this.monitors.findById(monitorId);
    if (!monitor) throw new NotFoundError('Monitor');
    // regra de negócio aqui — nunca no controller
  }
}
```

## SOLID e DDD

- **S** — um serviço / use case, uma responsabilidade.
- **O** — novos tipos de check via extensão (strategy/plugin), não `if` eternos.
- **L / I / D** — depender de abstrações; interfaces enxutas por consumidor.
- **DDD** — bounded contexts por módulo (`monitoring`, `incidents`, `alerts`). Eventos entre contextos, não imports cruzados de internals.

## Backend — capacidade futura

A API deve nascer preparada para:

- Múltiplos servidores de monitoramento
- Múltiplas regiões
- Milhares de monitores
- Milhões de registros de check
- Filas de processamento
- Workers dedicados
- Barramento de eventos (domínio → alertas / incidentes / analytics)

Isso implica:

- IDs estáveis (UUID)
- Checks idempotentes
- Escrita de histórico append-only / particionável
- Separação clara entre “ingestão” e “consulta”
- Contratos de evento versionados

## Qualidade obrigatória

Todo código novo deve ter:

- Tipagem forte
- Interfaces bem definidas
- Validação na borda (input)
- Tratamento de erros tipado
- Logs estruturados
- Testabilidade (unit + integration nos pontos críticos)
- Comentários **somente** quando o “porquê” não for óbvio

Evitar: duplicação, funções gigantes, god-services, acoplamento a detalhes de infra.

## Segurança (baseline)

JWT + Refresh Token, Rate Limit, Helmet, CORS restrito, sanitização, validação, criptografia de segredos, proteção CSRF / XSS / SQL Injection, audit logs onde fizer sentido.

## API pública

- REST primeiro
- OpenAPI / Swagger gerado ou mantido junto do código
- Arquitetura de módulos não deve impedir GraphQL no futuro (use cases reutilizáveis)
- Toda feature de produto deve ser acionável via API

## Módulo AI

Package isolado (`packages/ai`). Consome eventos/read models; **nunca** é a fonte da verdade. Sugestões sempre com explicação. O sistema opera 100% sem IA.

## Decisões de evolução

| Decisão | Direção |
|---------|----------|
| Monorepo | Sim, com packages independentes |
| Banco | Acessado só via repositórios na infra |
| Comunicação inter-módulo | Events / ports, não DB compartilhado ad-hoc |
| Deploy | Apps independentes no futuro; um processo hoje é aceitável |
