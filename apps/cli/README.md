# @analytic-pulse/cli (`pulse`)

CLI oficial da [API pública](../../docs/API.md). Usa chaves `ap_pk_…` (não JWT do dashboard).

## Install

```bash
# no monorepo
npm run build:cli
npx pulse --help

# link global (opcional)
npm link -w @analytic-pulse/cli
```

## Quick start

1. No dashboard, crie uma chave em **/api-keys**.
2. Autentique:

```bash
pulse login --api-url https://sua-api.onrender.com --api-key ap_pk_...
# ou interativo: pulse login
```

Config em `~/.pulse/config.json` (ou `%USERPROFILE%\.pulse\config.json`).

Variáveis: `PULSE_API_URL`, `PULSE_API_KEY`, `PULSE_CONFIG_PATH`.

## Comandos

```
pulse login | logout | whoami
pulse monitor list | get <id> | create --name --url | delete <id> --yes
pulse status
pulse incidents [--status active]
pulse incidents get <id>
pulse ssl
pulse deploy [--url https://...]
```

Flag global `--json` para CI.
