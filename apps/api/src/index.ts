import { startOtel, getOtelStatus } from './observability/otel';
startOtel();

import express from 'express';
import cors from 'cors';
import { assertCriticalEnv, env, getAllowedOrigins } from './config/env';
import authRouter from './routes/auth';
import telegramRouter from './routes/telegram';
import { cronRouter, monitorsRouter } from './modules/monitoring';
import { incidentsRouter } from './modules/incidents';
import { alertsRouter } from './modules/alerts';
import { statusRouter, statusPageAdminRouter } from './modules/statuspage';
import { dashboardRouter } from './modules/dashboard';
import { mapRouter } from './modules/map';
import { analyticsRouter } from './modules/analytics';
import { sslRouter } from './modules/ssl';
import { dnsRouter } from './modules/dns';
import { agentsRouter } from './modules/agents';
import { dockerRouter } from './modules/docker';
import { kubernetesRouter } from './modules/kubernetes';
import { aiRouter } from './modules/ai';
import { eventsRouter } from './modules/realtime';
import { rumRouter } from './modules/rum';
import {
  apiKeysRouter,
  publicApiV1Router,
  openapiSpec,
} from './modules/publicapi';
import { checkDatabase } from './infrastructure/db';
import { registerTelegramWebhook } from './services/telegramApi';
import { logger } from './observability/logger';
import { getMetricsSnapshot, inc } from './observability/metrics';
import swaggerUi from 'swagger-ui-express';

assertCriticalEnv();

const app = express();
const allowedOrigins = getAllowedOrigins();

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    logger.warn('CORS blocked origin', { origin });
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-cron-secret',
    'x-api-key',
    'x-rum-token',
  ],
};

// RUM ingest: CORS permissivo (token-gated); demais rotas usam allowlist
app.use((req, res, next) => {
  if (req.path === '/api/rum/ingest' || req.originalUrl.startsWith('/api/rum/ingest')) {
    next();
    return;
  }
  cors(corsOptions)(req, res, next);
});
app.options(/.*/, (req, res, next) => {
  if (req.path === '/api/rum/ingest' || req.originalUrl.startsWith('/api/rum/ingest')) {
    next();
    return;
  }
  cors(corsOptions)(req, res, next);
});
// Limite explícito evita payloads enormes (padrão do Express é 100kb; fixamos aqui).
app.use(express.json({ limit: '100kb' }));


app.use((req, _res, next) => {
  inc('http_requests_total');
  logger.debug('HTTP request', { method: req.method, path: req.path });
  next();
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'analytic-pulse-api',
  });
});

app.get('/health/db', async (_req, res) => {
  const db = await checkDatabase();
  if (!db.connected) {
    return res.status(503).json({
      status: 'error',
      ...db,
      hint: 'Configure DATABASE_URL e POSTGRES_URL no Render (analytic-pulse-api → Environment)',
    });
  }
  if (!db.schema_ready) {
    return res.status(503).json({
      status: 'error',
      ...db,
      hint: 'Execute database/schema.sql no SQL Editor do seu Postgres (Neon ou Render)',
    });
  }
  return res.json({ status: 'ok', ...db });
});

app.get('/metrics', (_req, res) => {
  res.json({
    ...getMetricsSnapshot(),
    otel: getOtelStatus(),
  });
});

app.use('/api/auth', authRouter);
app.use('/api/monitors', monitorsRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/status-page', statusPageAdminRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/map', mapRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/ssl', sslRouter);
app.use('/api/dns', dnsRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/docker', dockerRouter);
app.use('/api/kubernetes', kubernetesRouter);
app.use('/api/ai', aiRouter);
app.use('/api/events', eventsRouter);
app.use('/api/rum', rumRouter);
app.use('/api/api-keys', apiKeysRouter);
app.use('/api/v1', publicApiV1Router);
app.get('/api/openapi.json', (_req, res) => {
  res.json(openapiSpec);
});
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec as never, {
    customSiteTitle: 'Analytic Pulse API',
    swaggerOptions: { persistAuthorization: true },
  })
);
app.use('/api/cron', cronRouter);
app.use('/api/status', statusRouter);
app.use('/api/telegram', telegramRouter);

app.listen(env.port, async () => {
  logger.info('API started', {
    port: env.port,
    env: env.nodeEnv,
    cors_origins: allowedOrigins,
  });

  const db = await checkDatabase();
  if (!db.connected) {
    logger.error('Database unavailable', { error: db.error });
  } else if (!db.schema_ready) {
    logger.warn('Database connected but schema missing — run schema.sql');
  } else {
    logger.info('Database connected and schema ready');
  }

  await registerTelegramWebhook();
});

export default app;
