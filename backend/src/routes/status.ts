import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

/**
 * GET /api/status/:slug
 * Fully public endpoint — no authentication required.
 * Returns monitors + 90-day uptime grid for the status page.
 * The "slug" is the user's unique slug stored in their profile.
 */
router.get('/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;

  try {
    // 1. Look up the user by their public slug
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, display_name, page_title, page_description')
      .eq('slug', slug)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Status page not found' });
    }

    // 2. Fetch all active monitors for this user
    const { data: monitors, error: monitorsError } = await supabase
      .from('monitors')
      .select('id, name, url, status, last_checked_at, last_response_time_ms')
      .eq('user_id', profile.user_id)
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    if (monitorsError) throw monitorsError;

    if (!monitors || monitors.length === 0) {
      return res.json({
        profile,
        monitors: [],
        uptime_grids: {},
      });
    }

    // 3. Fetch 90-day aggregated uptime grid via SQL view (efficient GROUP BY)
    const monitorIds = monitors.map(m => m.id);
    const { data: grid, error: gridError } = await supabase
      .from('uptime_daily')
      .select('monitor_id, day, total_pings, up_pings, uptime_pct')
      .in('monitor_id', monitorIds)
      .gte('day', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('day', { ascending: true });

    if (gridError) throw gridError;

    // 4. Group the grid data by monitor_id for easy frontend consumption
    const uptimeGrids: Record<string, { day: string; uptime_pct: number; total_pings: number }[]> = {};

    for (const row of grid ?? []) {
      if (!uptimeGrids[row.monitor_id]) {
        uptimeGrids[row.monitor_id] = [];
      }
      uptimeGrids[row.monitor_id].push({
        day: row.day,
        uptime_pct: row.uptime_pct,
        total_pings: row.total_pings,
      });
    }

    // 5. Calculate overall uptime percentage per monitor
    const monitorsWithStats = monitors.map(monitor => {
      const days = uptimeGrids[monitor.id] ?? [];
      const totalPings = days.reduce((s, d) => s + d.total_pings, 0);
      const upPings = days.reduce((s, d) => s + Math.round(d.total_pings * d.uptime_pct / 100), 0);
      const overallUptime = totalPings > 0 ? ((upPings / totalPings) * 100).toFixed(2) : null;

      return {
        ...monitor,
        uptime_90d: overallUptime,
      };
    });

    return res.json({
      profile: {
        display_name: profile.display_name,
        page_title: profile.page_title,
        page_description: profile.page_description,
      },
      monitors: monitorsWithStats,
      uptime_grids: uptimeGrids,
    });
  } catch (err) {
    console.error('Status page error:', err);
    return res.status(500).json({ error: 'Failed to load status page' });
  }
});

export default router;
