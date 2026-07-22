# Analytic Pulse — CLI

Comando `pulse` (`@analytic-pulse/cli`) para a API pública `/api/v1`.

## Install

```bash
npm run build:cli
npx pulse --help
```

## Auth

Crie uma chave em `/api-keys` e rode:

```bash
pulse login --api-url https://SUA_API --api-key ap_pk_...
```

Ou exporte `PULSE_API_URL` + `PULSE_API_KEY`.

## Comandos (Fase 15)

| Comando | Descrição |
|---------|-----------|
| `pulse login` | Salva credenciais em `~/.pulse/config.json` |
| `pulse monitor create --name X --url Y` | Cria monitor |
| `pulse status` | Resumo do dashboard |
| `pulse incidents` | Lista incidentes |
| `pulse ssl` | Certificados / validade |
| `pulse deploy` | Health check (ou `--url` smoke HTTP) |

Extras: `logout`, `whoami`, `monitor list|get|delete`, `--json`.

Código: [`apps/cli`](../apps/cli).
