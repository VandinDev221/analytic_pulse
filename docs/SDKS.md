# Analytic Pulse — SDKs

Clientes oficiais para a API pública REST (`/api/v1`). Crie uma chave em `/api-keys` (`ap_pk_…`).

| Linguagem | Status | Caminho |
|-----------|--------|---------|
| TypeScript / JavaScript | ✅ | [`packages/sdk`](../packages/sdk) (`@analytic-pulse/sdk`) |
| Python | ✅ | [`sdks/python`](../sdks/python) (`analytic-pulse`) |
| Go | ✅ | [`sdks/go`](../sdks/go) |
| PHP | ⬜ scaffold | [`sdks/php`](../sdks/php) |
| Java | ⬜ scaffold | [`sdks/java`](../sdks/java) |
| C# | ⬜ scaffold | [`sdks/csharp`](../sdks/csharp) |
| Rust | ⬜ scaffold | [`sdks/rust`](../sdks/rust) |

## Quick start (TS)

```bash
npm run build -w @analytic-pulse/shared
npm run build -w @analytic-pulse/sdk
```

```ts
import { PulseClient } from '@analytic-pulse/sdk';
const pulse = new PulseClient({
  baseUrl: process.env.PULSE_API_URL!,
  apiKey: process.env.PULSE_API_KEY!,
});
await pulse.listMonitors();
```

## Quick start (Python)

```bash
cd sdks/python && pip install -e .
```

```python
from analytic_pulse import PulseClient
pulse = PulseClient(os.environ["PULSE_API_URL"], os.environ["PULSE_API_KEY"])
pulse.list_monitors()
```

Contrato HTTP: [`docs/API.md`](API.md) · OpenAPI: `/api/openapi.json`.
