import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { pingUrl, runInBatches } from '../services/pingService';
import { notifyStatusChange } from '../services/notificationService';
import { requireCronSecret } from '../middleware/auth';

const router = Router();

/**
 * GET /api/cron/ping
 * Called by cron-job.org on a schedule.
 * - Fetches all active monitors
 * - Pings them in batches of 5 (concurrency limiting)
 * - Saves results to ping_logs
 * - Sends Telegram alerts on status change
 */
router.get('/ping', requireCronSecret, async (_req: Request, res: Response) => {
  const startTime = Date.now();
  console.log(`\n🕐 Cron ping started at ${new Date().toISOString()}`);

  try {
    // 1. Fetch all active monitors
    const { data: monitors, error } = await supabase
      .from('monitors')
      .select('id, user_id, name, url, status')
      .eq('status', 'active');

    if (error) throw error;
    if (!monitors || monitors.length === 0) {
      return res.json({ message: 'No active monitors found', processed: 0 });
    }

    console.log(`📋 Found ${monitors.length} active monitors`);

    // 2. Create ping tasks for batch processing
    const tasks = monitors.map(monitor => async () => {
      const result = await pingUrl(monitor.url);

      // 3. Save result to ping_logs
      const { error: logError } = await supabase.from('ping_logs').insert({
        monitor_id: monitor.id,
        status_code: result.status_code,
        response_time_ms: result.response_time_ms,
        is_up: result.is_up,
        error_message: result.error_message,
      });

      if (logError) {
        console.error(`Failed to save log for ${monitor.url}:`, logError);
      }

      // 4. Determine previous status from monitor record
      const wasUp = monitor.status === 'up';
      const statusChanged = wasUp !== result.is_up;

      // 5. Update the monitor's current status
      const newStatus = result.is_up ? 'up' : 'down';
      await supabase
        .from('monitors')
        .update({
          status: newStatus,
          last_checked_at: new Date().toISOString(),
          last_response_time_ms: result.response_time_ms,
        })
        .eq('id', monitor.id);

      // 6. Send notification if status changed
      if (statusChanged) {
        console.log(`🔔 Status change detected for "${monitor.name}": ${wasUp ? 'UP→DOWN' : 'DOWN→UP'}`);
        await notifyStatusChange(
          monitor.user_id,
          monitor.name,
          monitor.url,
          result.is_up,
          result.status_code,
          result.error_message
        );
      }

      return { monitorId: monitor.id, name: monitor.name, ...result };
    });

    // Run in batches of 5 to avoid overloading the free-tier server
    const results = await runInBatches(tasks, 5);

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failCount = results.filter(r => r.status === 'rejected').length;
    const elapsed = Date.now() - startTime;

    console.log(`✅ Cron completed in ${elapsed}ms — ${successCount} ok, ${failCount} failed`);

    return res.json({
      message: 'Ping cycle complete',
      processed: monitors.length,
      success: successCount,
      failed: failCount,
      elapsed_ms: elapsed,
    });
  } catch (err) {
    console.error('Cron ping error:', err);
    return res.status(500).json({ error: 'Internal server error during cron ping' });
  }
});

export default router;
