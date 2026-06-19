import { Router, Request, Response } from 'express';
import { handleTelegramUpdate } from '../services/telegramBotService';

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

  // Responde imediatamente ao Telegram (timeout 60s)
  res.status(200).json({ ok: true });

  const update = req.body;
  if (update?.message) {
    handleTelegramUpdate(update).catch((err) =>
      console.error('Telegram webhook handler error:', err)
    );
  }
});

export default router;
