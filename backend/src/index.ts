import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import monitorsRouter from './routes/monitors';
import cronRouter from './routes/cron';
import statusRouter from './routes/status';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// ── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/monitors', monitorsRouter);
app.use('/api/cron', cronRouter);
app.use('/api/status', statusRouter);

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 PingPulse backend running on port ${PORT}`);
});

export default app;
