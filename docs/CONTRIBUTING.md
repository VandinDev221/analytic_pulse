# Contributing — Analytic Pulse

Obrigado por contribuir. Este projeto mira qualidade de produto SaaS premium. PRs pequenos e alinhados à visão vencem PRs enormes.

## Antes de começar

1. Leia [VISION.md](./VISION.md)
2. Confira a fase em [ROADMAP.md](./ROADMAP.md)
3. Siga [ARCHITECTURE.md](./ARCHITECTURE.md) e [UI_GUIDELINES.md](./UI_GUIDELINES.md)

## Como escolher trabalho

- Prefira **um épico / uma fatia vertical** (ex.: “TCP check + histórico”, não “todo Monitoring”).
- Não misture refatoração ampla com feature nova no mesmo PR.
- Se a mudança exigir novo package ou boundary, documente a decisão no PR.

## Padrões de código

### Backend

- Controllers/routes **sem** regra de negócio
- Services + Repository Pattern
- Tipagem forte; validação na borda
- Erros tipados; logs estruturados
- Testes para use cases críticos

### Frontend

- Componentes reutilizáveis; preferir Design System
- Cobrir Loading / Empty / Error / Offline / Success
- Sem Material-UI look; seguir UI Guidelines
- Tipagem forte; evitar lógica de domínio no JSX

### Geral

- Sem soluções temporárias (“depois refatora”)
- Sem comentários óbvios
- Sem duplicação — extrair para `shared` / `ui` quando houver segundo uso real

## Fluxo de PR

1. Branch a partir de `main`: `feat/fase-1-tcp-check`, `fix/...`, `chore/...`
2. Escopo fechado e descrevível em 1–3 bullets
3. Testes / validação manual descritos
4. Checklist do PR:

```markdown
## Summary
- …

## Checklist
- [ ] Alinhado à fase do ROADMAP
- [ ] Sem regra de negócio em controllers
- [ ] Estados de UI cobertos (se UI)
- [ ] Sem secrets no commit
- [ ] README/docs atualizados se necessário
```

## O que será rejeitado

- Big-bang cobrindo várias fases do roadmap
- Acesso direto ao banco fora da camada de infra/repositório
- IA embutida em regras de domínio core
- UI sem empty/error/loading
- Código sem tipagem ou com `any` injustificado

## Setup local

```bash
npm install
npm run build:shared
npm run dev:api      # apps/api — :3001
npm run dev:web      # apps/web — :5173
```

Variáveis: copie `apps/api/.env.example` e `apps/web/.env.example`.

Ver [README.md](../README.md) para deploy.

## Comunicação

- Issues para bugs e épicos
- Discussões de arquitetura referenciam `docs/ARCHITECTURE.md`
- Mudanças de visão/roadmap: PR nos docs, não só no chat

## Licença

Ao contribuir, você concorda que o código entra sob a licença MIT do repositório.
