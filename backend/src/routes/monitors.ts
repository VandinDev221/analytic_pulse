import { Router, Response } from 'express';
import { supabase } from '../lib/supabase';
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

  const { data, error } = await supabase
    .from('monitors')
    .insert({
      user_id: req.userId,
      name,
      url,
      method,
      interval_minutes,
      status: 'active',
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
});

// ── GET /api/monitors ─────────────────────────────────────────────────────────
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabase
    .from('monitors')
    .select('*')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// ── GET /api/monitors/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabase
    .from('monitors')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .single();

  if (error) return res.status(404).json({ error: 'Monitor not found' });
  return res.json(data);
});

// ── PATCH /api/monitors/:id ───────────────────────────────────────────────────
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { name, url, method, interval_minutes, status } = req.body;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (url !== undefined) updates.url = url;
  if (method !== undefined) updates.method = method;
  if (interval_minutes !== undefined) updates.interval_minutes = interval_minutes;
  if (status !== undefined) updates.status = status;

  const { data, error } = await supabase
    .from('monitors')
    .update(updates)
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// ── DELETE /api/monitors/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { error } = await supabase
    .from('monitors')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.userId);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(204).send();
});

// ── GET /api/monitors/:id/metrics ─────────────────────────────────────────────
router.get('/:id/metrics', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  // Verify ownership
  const { data: monitor, error: monitorError } = await supabase
    .from('monitors')
    .select('id')
    .eq('id', id)
    .eq('user_id', req.userId)
    .single();

  if (monitorError || !monitor) {
    return res.status(404).json({ error: 'Monitor not found' });
  }

  // Use the aggregated SQL view for 7-day uptime and average latency
  const { data: metrics, error: metricsError } = await supabase.rpc('get_monitor_metrics', {
    p_monitor_id: id,
  });

  if (metricsError) return res.status(500).json({ error: metricsError.message });

  // Recent latency data (last 100 pings) for the chart
  const { data: recentLogs, error: logsError } = await supabase
    .from('ping_logs')
    .select('response_time_ms, is_up, created_at, status_code, error_message')
    .eq('monitor_id', id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (logsError) return res.status(500).json({ error: logsError.message });

  return res.json({
    metrics: metrics?.[0] ?? null,
    recent_logs: recentLogs ?? [],
  });
});

// ── GET /api/monitors/:id/settings (Notification settings) ───────────────────
router.get('/:id/notifications', async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabase
    .from('notification_settings')
    .select('id, telegram_chat_id, is_enabled')
    .eq('user_id', req.userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    return res.status(500).json({ error: error.message });
  }
  return res.json(data ?? null);
});

// ── PUT /api/monitors/notifications ──────────────────────────────────────────
router.put('/notifications/settings', async (req: AuthenticatedRequest, res: Response) => {
  const { telegram_bot_token, telegram_chat_id, is_enabled } = req.body;

  const { data, error } = await supabase
    .from('notification_settings')
    .upsert({
      user_id: req.userId,
      telegram_bot_token,
      telegram_chat_id,
      is_enabled,
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

export default router;
