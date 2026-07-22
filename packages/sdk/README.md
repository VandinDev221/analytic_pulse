# @analytic-pulse/sdk

SDK oficial **TypeScript / JavaScript** para a [API pública](../../docs/API.md) Analytic Pulse (`/api/v1`).

## Install

```bash
# no monorepo
npm install -w @analytic-pulse/sdk

# ou a partir da pasta
cd packages/sdk && npm install && npm run build
```

## Uso

```ts
import { PulseClient } from '@analytic-pulse/sdk';

const pulse = new PulseClient({
  baseUrl: 'https://sua-api.onrender.com',
  apiKey: process.env.PULSE_API_KEY!, // ap_pk_…
});

const monitors = await pulse.listMonitors();
const created = await pulse.createMonitor({
  name: 'Home',
  url: 'https://example.com',
  check_type: 'https',
});
```

## Métodos

| Método | Endpoint |
|--------|----------|
| `listMonitors` / `getMonitor` / `createMonitor` / `updateMonitor` / `deleteMonitor` | `/monitors` |
| `getMonitorMetrics` | `/monitors/:id/metrics` |
| `listIncidents` / `getIncident` | `/incidents` |
| `getDashboardOverview` | `/dashboard/overview` |
| `getAnalyticsOverview` | `/analytics/overview` |
| `getSslOverview` / `getDnsOverview` / `getMapOverview` | overviews |
| `listAgents` / `getAgent` | `/agents` |
| `getDockerOverview` / `getKubernetesOverview` | infra |

Erros HTTP viram `PulseApiError` (`status`, `code`, `body`).
