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
const allowedOrigin = process.env.FRONTEND_URL;
if (!allowedOrigin && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  FRONTEND_URL not set — CORS may block browser requests');
}

app.use(cors({
  origin: allowedOrigin || true,
  credentials: true,
}));
app.use(express.json());

// ── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
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
