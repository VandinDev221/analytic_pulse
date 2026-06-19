import { Router, Response } from 'express';
import { query } from '../lib/db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// All routes below require authentication
router.use(requireAuth as any);

// ── POST /api/monitors ────────────────────────────────────────────────────────
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const { name, url, method = 'GET', interval_minutes = 5 } = req.body;

  if (!name || !url) {
    return res.status(400).json({ error: 'name and url are required' });
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  try {
    const result = await query(
      `INSERT INTO monitors (user_id, name, url, method, interval_minutes, status) 
       VALUES ($1, $2, $3, $4, $5, 'active') 
       RETURNING *`,
      [req.userId, name, url, method, interval_minutes]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── GET /api/monitors ─────────────────────────────────────────────────────────
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM monitors 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [req.userId]
    );
    return res.json(result.rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── GET /api/monitors/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM monitors 
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Monitor not found' });
    }
    return res.json(result.rows[0]);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── PATCH /api/monitors/:id ───────────────────────────────────────────────────
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { name, url, method, interval_minutes, status } = req.body;

  const fields: string[] = [];
  const values: any[] = [];
  let index = 1;

  if (name !== undefined) {
    fields.push(`name = $${index++}`);
    values.push(name);
  }
  if (url !== undefined) {
    fields.push(`url = $${index++}`);
    values.push(url);
  }
  if (method !== undefined) {
    fields.push(`method = $${index++}`);
    values.push(method);
  }
  if (interval_minutes !== undefined) {
    fields.push(`interval_minutes = $${index++}`);
    values.push(interval_minutes);
  }
  if (status !== undefined) {
    fields.push(`status = $${index++}`);
    values.push(status);
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  // Add id and userId filters
  values.push(req.params.id);
  const idIndex = index++;
  values.push(req.userId);
  const userIndex = index++;

  try {
    const result = await query(
      `UPDATE monitors 
       SET ${fields.join(', ')} 
       WHERE id = $${idIndex} AND user_id = $${userIndex} 
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Monitor not found' });
    }
    return res.json(result.rows[0]);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── DELETE /api/monitors/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `DELETE FROM monitors 
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Monitor not found or unauthorized' });
    }
    return res.status(204).send();
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── GET /api/monitors/:id/metrics ─────────────────────────────────────────────
router.get('/:id/metrics', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    // 1. Verify ownership
    const monitorCheck = await query(
      `SELECT id FROM monitors 
       WHERE id = $1 AND user_id = $2`,
      [id, req.userId]
    );

    if (monitorCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Monitor not found' });
    }

    // 2. Call Postgres function
    const metricsResult = await query(
      `SELECT * FROM get_monitor_metrics($1)`,
      [id]
    );

    // 3. Fetch recent logs
    const logsResult = await query(
      `SELECT response_time_ms, is_up, created_at, status_code, error_message 
       FROM ping_logs 
       WHERE monitor_id = $1 
       ORDER BY created_at DESC 
       LIMIT 100`,
      [id]
    );

    return res.json({
      metrics: metricsResult.rows[0] ?? null,
      recent_logs: logsResult.rows ?? [],
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── GET /api/monitors/:id/notifications (Notification settings) ───────────────────
router.get('/:id/notifications', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, telegram_chat_id, is_enabled 
       FROM notification_settings 
       WHERE user_id = $1`,
      [req.userId]
    );

    return res.json(result.rows[0] ?? null);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── PUT /api/monitors/notifications ──────────────────────────────────────────
router.put('/notifications/settings', async (req: AuthenticatedRequest, res: Response) => {
  const { telegram_bot_token, telegram_chat_id, is_enabled } = req.body;

  try {
    const result = await query(
      `INSERT INTO notification_settings (user_id, telegram_bot_token, telegram_chat_id, is_enabled, updated_at) 
       VALUES ($1, $2, $3, $4, NOW()) 
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         telegram_bot_token = EXCLUDED.telegram_bot_token, 
         telegram_chat_id = EXCLUDED.telegram_chat_id, 
         is_enabled = EXCLUDED.is_enabled, 
         updated_at = NOW() 
       RETURNING *`,
      [req.userId, telegram_bot_token, telegram_chat_id, is_enabled]
    );

    return res.json(result.rows[0]);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
