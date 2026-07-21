import { Router, Response } from 'express';
import { isAppError } from '@analytic-pulse/shared';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../../../middleware/auth';
import { query } from '../../../infrastructure/db';
import { sendTestNotification } from '../../../services/notificationService';
import { PgMonitorRepository } from '../repositories/PgMonitorRepository';
import { MonitorService } from '../services/MonitorService';

const router = Router();
const monitorService = new MonitorService(new PgMonitorRepository());

router.use(requireAuth as never);

function handleError(res: Response, error: unknown) {
  if (isAppError(error)) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      details: error.details,
    });
  }
  const message = error instanceof Error ? error.message : 'Internal server error';
  return res.status(500).json({ error: message });
}

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const monitor = await monitorService.create(req.userId!, req.body);
    return res.status(201).json(monitor);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const monitors = await monitorService.list(req.userId!);
    return res.json(monitors);
  } catch (error) {
    return handleError(res, error);
  }
});

// Notification settings (legado — permanece até Fase 3 Alert Engine)
router.get('/notifications/settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT notification_channel, telegram_bot_token, telegram_chat_id,
              whatsapp_phone, whatsapp_api_key, is_enabled
       FROM notification_settings WHERE user_id = $1`,
      [req.userId]
    );
    const row = result.rows[0];
    if (!row) {
      return res.json({
        notification_channel: 'telegram',
        telegram_bot_token: '',
        telegram_chat_id: '',
        whatsapp_phone: '',
        whatsapp_api_key: '',
        is_enabled: false,
      });
    }
    return res.json(row);
  } catch (error: unknown) {
    return handleError(res, error);
  }
});

router.put('/notifications/settings', async (req: AuthenticatedRequest, res: Response) => {
  const {
    notification_channel = 'telegram',
    telegram_bot_token,
    telegram_chat_id,
    whatsapp_phone,
    whatsapp_api_key,
    is_enabled,
  } = req.body;

  if (!['telegram', 'whatsapp'].includes(notification_channel)) {
    return res.status(400).json({ error: 'Canal inválido' });
  }

  try {
    const result = await query(
      `INSERT INTO notification_settings (
         user_id, notification_channel, telegram_bot_token, telegram_chat_id,
         whatsapp_phone, whatsapp_api_key, is_enabled, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         notification_channel = EXCLUDED.notification_channel,
         telegram_bot_token = EXCLUDED.telegram_bot_token,
         telegram_chat_id = EXCLUDED.telegram_chat_id,
         whatsapp_phone = EXCLUDED.whatsapp_phone,
         whatsapp_api_key = EXCLUDED.whatsapp_api_key,
         is_enabled = EXCLUDED.is_enabled,
         updated_at = NOW()
       RETURNING notification_channel, telegram_bot_token, telegram_chat_id,
                 whatsapp_phone, whatsapp_api_key, is_enabled`,
      [
        req.userId,
        notification_channel,
        telegram_bot_token || null,
        telegram_chat_id || null,
        whatsapp_phone || null,
        whatsapp_api_key || null,
        is_enabled ?? false,
      ]
    );
    return res.json(result.rows[0]);
  } catch (error: unknown) {
    return handleError(res, error);
  }
});

router.post('/notifications/test', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await sendTestNotification(req.userId!);
    return res.json({ message: 'Notificação de teste enviada' });
  } catch (error: unknown) {
    return handleError(res, error);
  }
});

function paramId(req: AuthenticatedRequest): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0]! : id!;
}

router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const monitor = await monitorService.getById(paramId(req), req.userId!);
    return res.json(monitor);
  } catch (error) {
    return handleError(res, error);
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const monitor = await monitorService.update(
      paramId(req),
      req.userId!,
      req.body
    );
    return res.json(monitor);
  } catch (error) {
    return handleError(res, error);
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await monitorService.remove(paramId(req), req.userId!);
    return res.status(204).send();
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:id/metrics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = await monitorService.getMetrics(paramId(req), req.userId!);
    return res.json(payload);
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;
