import type {
  CheckType,
  MapLink,
  MapOverview,
  MapRegion,
  MapRegionAggregate,
  MapServiceNode,
  MonitorStatus,
} from '@analytic-pulse/shared';
import { MAP_REGIONS } from '@analytic-pulse/shared';
import { query } from '../../../infrastructure/db';

function jitter(seed: string, index: number, total: number): { dLat: number; dLng: number } {
  if (total <= 1) return { dLat: 0, dLng: 0 };
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const angle = ((index / total) * Math.PI * 2) + (hash % 360) * (Math.PI / 180);
  const radius = 1.2 + (total > 4 ? 0.4 : 0);
  return {
    dLat: Math.sin(angle) * radius,
    dLng: Math.cos(angle) * radius,
  };
}

function heartbeatAlive(
  lastCheckedAt: Date | string | null,
  intervalMinutes: number
): boolean {
  if (!lastCheckedAt) return false;
  const ageMs = Date.now() - new Date(lastCheckedAt).getTime();
  return ageMs <= intervalMinutes * 60_000 * 2.5;
}

export class MapService {
  async listRegions(): Promise<MapRegion[]> {
    try {
      const result = await query(
        `SELECT code, name, city, country_code, latitude, longitude
         FROM map_regions
         ORDER BY name ASC`
      );
      if (result.rows.length > 0) {
        return (result.rows as Array<Record<string, unknown>>).map((r) => ({
          code: r.code as string,
          name: r.name as string,
          city: (r.city as string | null) ?? null,
          country_code: r.country_code as string,
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
        }));
      }
    } catch {
      // tabela ainda não migrada — fallback estático
    }
    return MAP_REGIONS;
  }

  async getOverview(userId: string): Promise<MapOverview> {
    const regions = await this.listRegions();
    const regionMap = new Map(regions.map((r) => [r.code, r]));

    let monitors: Array<{
      id: string;
      name: string;
      status: MonitorStatus;
      check_type: CheckType;
      region_code: string | null;
      last_probe_region: string | null;
      last_response_time_ms: number | null;
      last_checked_at: Date | string | null;
      interval_minutes: number;
    }> = [];

    try {
      const result = await query(
        `SELECT id, name, status, check_type, region_code, last_probe_region,
                last_response_time_ms, last_checked_at, interval_minutes
         FROM monitors
         WHERE user_id = $1 AND status != 'inactive'
         ORDER BY created_at ASC`,
        [userId]
      );
      monitors = result.rows as typeof monitors;
    } catch {
      try {
        const result = await query(
          `SELECT id, name, status, check_type, region_code,
                  last_response_time_ms, last_checked_at, interval_minutes
           FROM monitors
           WHERE user_id = $1 AND status != 'inactive'
           ORDER BY created_at ASC`,
          [userId]
        );
        monitors = (result.rows as Array<Omit<(typeof monitors)[0], 'last_probe_region'>>).map(
          (m) => ({
            ...m,
            last_probe_region: null,
          })
        );
      } catch {
        const result = await query(
          `SELECT id, name, status, check_type,
                  last_response_time_ms, last_checked_at, interval_minutes
           FROM monitors
           WHERE user_id = $1 AND status != 'inactive'
           ORDER BY created_at ASC`,
          [userId]
        );
        monitors = (
          result.rows as Array<Omit<(typeof monitors)[0], 'region_code' | 'last_probe_region'>>
        ).map((m) => ({
          ...m,
          region_code: 'gru',
          last_probe_region: null,
        }));
      }
    }

    const byRegion = new Map<string, typeof monitors>();
    for (const m of monitors) {
      const code = m.region_code && regionMap.has(m.region_code) ? m.region_code : 'gru';
      const list = byRegion.get(code) ?? [];
      list.push({ ...m, region_code: code });
      byRegion.set(code, list);
    }

    const nodes: MapServiceNode[] = [];
    for (const [code, list] of byRegion) {
      const region = regionMap.get(code)!;
      list.forEach((m, index) => {
        const { dLat, dLng } = jitter(m.id, index, list.length);
        nodes.push({
          id: m.id,
          name: m.name,
          status: m.status,
          check_type: m.check_type,
          region_code: code,
          latitude: region.latitude + dLat,
          longitude: region.longitude + dLng,
          last_response_time_ms: m.last_response_time_ms,
          last_checked_at: m.last_checked_at
            ? new Date(m.last_checked_at).toISOString()
            : null,
          interval_minutes: m.interval_minutes,
          heartbeat_alive: heartbeatAlive(m.last_checked_at, m.interval_minutes),
          last_probe_region: m.last_probe_region ?? null,
        });
      });
    }

    const regionAggregates: MapRegionAggregate[] = [];
    for (const region of regions) {
      const list = byRegion.get(region.code) ?? [];
      if (list.length === 0) continue;
      const latencies = list
        .map((m) => m.last_response_time_ms)
        .filter((v): v is number => v != null);
      regionAggregates.push({
        region,
        monitors_total: list.length,
        monitors_up: list.filter((m) => m.status === 'up').length,
        monitors_down: list.filter((m) => m.status === 'down').length,
        avg_latency_ms:
          latencies.length > 0
            ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
            : null,
      });
    }

    const activeCodes = [...byRegion.keys()];
    const links: MapLink[] = [];
    for (let i = 0; i < activeCodes.length; i++) {
      for (let j = i + 1; j < activeCodes.length; j++) {
        links.push({ from_region: activeCodes[i]!, to_region: activeCodes[j]! });
      }
    }

    const allLatencies = nodes
      .map((n) => n.last_response_time_ms)
      .filter((v): v is number => v != null);

    return {
      summary: {
        monitors_total: nodes.length,
        monitors_up: nodes.filter((n) => n.status === 'up').length,
        monitors_down: nodes.filter((n) => n.status === 'down').length,
        avg_latency_ms:
          allLatencies.length > 0
            ? Math.round(allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length)
            : null,
        regions_active: regionAggregates.length,
      },
      regions: regionAggregates,
      nodes,
      links,
    };
  }
}
