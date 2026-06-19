import { Router, Request, Response } from 'express';
import { handleTelegramUpdate } from '../services/telegramBotService';
import {
  registerTelegramWebhook,
  getWebhookInfo,
} from '../services/telegramApi';
import { requireCronSecret } from '../middleware/auth';

const router = Router();

/**
 * POST /api/telegram/webhook
 * Receives updates from Telegram Bot API.
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) {
    return res.status(403).json({ error: 'Invalid webhook secret' });
  }

  res.status(200).json({ ok: true });

  const update = req.body;
  if (update?.message) {
    handleTelegramUpdate(update).catch((err) =>
      console.error('Telegram webhook handler error:', err)
    );
  }
});

/**
 * POST /api/telegram/setup-webhook
 * Registra o webhook manualmente (protegido por CRON_SECRET).
 */
router.post('/setup-webhook', requireCronSecret, async (_req: Request, res: Response) => {
  const ok = await registerTelegramWebhook();
  const info = await getWebhookInfo();
  return res.json({ ok, webhook: info });
});

/**
 * GET /api/telegram/webhook-info
 * Diagnóstico do webhook (protegido por CRON_SECRET).
 */
router.get('/webhook-info', requireCronSecret, async (_req: Request, res: Response) => {
  const info = await getWebhookInfo();
  return res.json(info ?? { error: 'Bot token not configured' });
});

export default router;
