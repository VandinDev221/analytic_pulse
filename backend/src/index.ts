import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './routes/auth';
import monitorsRouter from './routes/monitors';
import cronRouter from './routes/cron';
import statusRouter from './routes/status';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────────────────────────────────
// FRONTEND_URL ou CORS_ORIGINS: uma ou mais URLs separadas por vírgula
function getAllowedOrigins(): string[] | boolean {
  const raw = process.env.CORS_ORIGINS || process.env.FRONTEND_URL;
  if (!raw?.trim()) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️  FRONTEND_URL / CORS_ORIGINS not set — CORS may block browser requests');
    }
    return process.env.NODE_ENV !== 'production';
  }
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

const allowedOrigins = getAllowedOrigins();

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-cron-secret'],
}));
app.use(express.json());

// ── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/monitors', monitorsRouter);
app.use('/api/cron', cronRouter);
app.use('/api/status', statusRouter);

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 PingPulse backend running on port ${PORT}`);
});

export default app;
