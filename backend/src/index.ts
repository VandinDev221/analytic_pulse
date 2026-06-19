import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './routes/auth';
import monitorsRouter from './routes/monitors';
import cronRouter from './routes/cron';
import statusRouter from './routes/status';
import telegramRouter from './routes/telegram';
import { checkDatabase } from './lib/db';
import { registerTelegramWebhook } from './services/telegramApi';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ── CORS ─────────────────────────────────────────────────────────────────────
const DEFAULT_ORIGINS = [
  'https://analytic-pulse.vercel.app',
  'https://analytic-pulse-web.onrender.com',
];

function getAllowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '';
  const fromEnv = raw.split(',').map((o) => o.trim()).filter(Boolean);
  return [...new Set([...fromEnv, ...DEFAULT_ORIGINS])];
}

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
    console.warn(`CORS blocked origin: ${origin}`);
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-cron-secret'],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json());

// ── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/health/db', async (_req: express.Request, res: express.Response) => {
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

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/monitors', monitorsRouter);
app.use('/api/cron', cronRouter);
app.use('/api/status', statusRouter);
app.use('/api/telegram', telegramRouter);

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`🚀 PingPulse backend running on port ${PORT}`);
  console.log(`🌐 CORS origins: ${allowedOrigins.join(', ')}`);
  const db = await checkDatabase();
  if (!db.connected) {
    console.error(`❌ Database: ${db.error}`);
  } else if (!db.schema_ready) {
    console.warn('⚠️  Database conectado, mas tabela users não existe — rode schema.sql');
  } else {
    console.log('✅ Database conectado e schema OK');
  }

  await registerTelegramWebhook();
});

export default app;
