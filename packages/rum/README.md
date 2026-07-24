# `@analytic-pulse/rum`

SDK leve de **Real User Monitoring** para sites dos clientes do PingPulse.

Coleta:

- Page views
- Web Vitals (LCP, INP, CLS, FCP, TTFB)
- Erros de `window.onerror` / `unhandledrejection`

## Instalação

```bash
npm install @analytic-pulse/rum
```

## Uso

1. No dashboard PingPulse → **RUM**, crie um site e copie o token `ap_rum_…`.
2. No frontend do seu produto:

```ts
import { init } from '@analytic-pulse/rum';

init({
  endpoint: 'https://sua-api',
  token: 'ap_rum_...',
  sampleRate: 1,
});
```

Eventos vão para `POST /api/rum/ingest` (CORS liberado; autenticação pelo token).
