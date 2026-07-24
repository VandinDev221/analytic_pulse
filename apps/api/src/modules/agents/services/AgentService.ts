import crypto from 'crypto';
import type {
  Agent,
  AgentCreated,
  AgentDetail,
  AgentKind,
  AgentMetricsPayload,
  AgentSnapshotPoint,
  AgentStatus,
  AgentsOverview,
  CreateAgentInput,
} from '@analytic-pulse/shared';
import { NotFoundError, ValidationError } from '@analytic-pulse/shared';
import { MAP_REGIONS } from '@analytic-pulse/shared';
import { query } from '../../../infrastructure/db';
import { realtimeHub } from '../../realtime';

const OFFLINE_AFTER_MS = 120_000;
const VALID_KINDS: AgentKind[] = ['host', 'probe'];
const VALID_REGIONS = new Set(MAP_REGIONS.map((r) => r.code));

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken(): { token: string; prefix: string; hash: string } {
  const raw = crypto.randomBytes(24).toString('base64url');
  const token = `ap_agent_${raw}`;
  return {
    token,
    prefix: token.slice(0, 14),
    hash: hashToken(token),
  };
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  return new Date(value).toISOString();
}

function mapAgent(row: Record<string, unknown>): Agent {
  const lastSeen = row.last_seen_at
    ? new Date(row.last_seen_at as Date | string).getTime()
    : null;
  let status = (row.status as AgentStatus) || 'pending';
  if (status !== 'disabled' && lastSeen != null) {
    status =
      Date.now() - lastSeen > OFFLINE_AFTER_MS ? 'offline' : 'online';
  } else if (status !== 'disabled' && lastSeen == null) {
    status = 'pending';
  }

  return {
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    hostname: (row.hostname as string | null) ?? null,
    token_prefix: row.token_prefix as string,
    status,
    kind: ((row.kind as AgentKind) || 'host') as AgentKind,
    region_code: (row.region_code as string | null) ?? null,
    agent_version: (row.agent_version as string | null) ?? null,
    os_info: (row.os_info as Agent['os_info']) || {},
    latest_metrics: (row.latest_metrics as AgentMetricsPayload) || {},
    last_seen_at: toIso(row.last_seen_at as Date | string | null),
    created_at: toIso(row.created_at as Date | string)!,
    updated_at: toIso(row.updated_at as Date | string)!,
  };
}

export class AgentService {
  async create(
    userId: string,
    input: CreateAgentInput
  ): Promise<AgentCreated> {
    if (!input.name?.trim()) throw new ValidationError('name is required');
    const kind: AgentKind = input.kind === 'probe' ? 'probe' : 'host';
    if (input.kind && !VALID_KINDS.includes(input.kind)) {
      throw new ValidationError('Invalid agent kind');
    }
    let regionCode: string | null = input.region_code?.trim() || null;
    if (kind === 'probe') {
      if (!regionCode || !VALID_REGIONS.has(regionCode)) {
        throw new ValidationError(
          'Probe agents require a valid region_code (ex: gru, iad, fra)'
        );
      }
    } else if (regionCode && !VALID_REGIONS.has(regionCode)) {
      regionCode = null;
    }

    const { token, prefix, hash } = generateToken();

    try {
      const result = await query(
        `INSERT INTO agents (user_id, name, token_hash, token_prefix, status, kind, region_code)
         VALUES ($1, $2, $3, $4, 'pending', $5, $6)
         RETURNING *`,
        [userId, input.name.trim(), hash, prefix, kind, regionCode]
      );
      return { ...mapAgent(result.rows[0]), token };
    } catch {
      // migration ainda não aplicada — fallback sem kind/region
      const result = await query(
        `INSERT INTO agents (user_id, name, token_hash, token_prefix, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING *`,
        [userId, input.name.trim(), hash, prefix]
      );
      return { ...mapAgent(result.rows[0]), token };
    }
  }

  async findByIdInternal(id: string): Promise<Agent | null> {
    const result = await query(`SELECT * FROM agents WHERE id = $1`, [id]);
    if (!result.rows[0]) return null;
    return mapAgent(result.rows[0]);
  }

  async touch(agentId: string): Promise<void> {
    await query(
      `UPDATE agents
       SET last_seen_at = NOW(), status = 'online', updated_at = NOW()
       WHERE id = $1`,
      [agentId]
    );
  }

  async list(userId: string): Promise<AgentsOverview> {
    const result = await query(
      `SELECT * FROM agents
       WHERE user_id = $1
       ORDER BY COALESCE(last_seen_at, created_at) DESC`,
      [userId]
    );
    const agents = (result.rows as Record<string, unknown>[]).map(mapAgent);
    return {
      summary: {
        total: agents.length,
        online: agents.filter((a) => a.status === 'online').length,
        offline: agents.filter((a) => a.status === 'offline').length,
        pending: agents.filter(
          (a) => a.status === 'pending' || a.status === 'disabled'
        ).length,
      },
      agents,
    };
  }

  async getById(userId: string, id: string): Promise<AgentDetail> {
    const result = await query(
      `SELECT * FROM agents WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (!result.rows[0]) throw new NotFoundError('Agent');

    const historyResult = await query(
      `SELECT collected_at, cpu_pct, mem_pct, swap_pct, disk_pct, temperature_c, load_1
       FROM agent_snapshots
       WHERE agent_id = $1
       ORDER BY collected_at DESC
       LIMIT 120`,
      [id]
    );

    const history: AgentSnapshotPoint[] = (
      historyResult.rows as Array<Record<string, unknown>>
    )
      .map((row) => ({
        collected_at: toIso(row.collected_at as Date | string)!,
        cpu_pct: row.cpu_pct != null ? Number(row.cpu_pct) : null,
        mem_pct: row.mem_pct != null ? Number(row.mem_pct) : null,
        swap_pct: row.swap_pct != null ? Number(row.swap_pct) : null,
        disk_pct: row.disk_pct != null ? Number(row.disk_pct) : null,
        temperature_c:
          row.temperature_c != null ? Number(row.temperature_c) : null,
        load_1: row.load_1 != null ? Number(row.load_1) : null,
      }))
      .reverse();

    return { ...mapAgent(result.rows[0]), history };
  }

  async delete(userId: string, id: string): Promise<void> {
    const result = await query(
      `DELETE FROM agents WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if ((result.rowCount ?? 0) === 0) throw new NotFoundError('Agent');
  }

  async findByToken(token: string): Promise<Agent | null> {
    const hash = hashToken(token);
    const result = await query(
      `SELECT * FROM agents WHERE token_hash = $1 AND status != 'disabled'`,
      [hash]
    );
    if (!result.rows[0]) return null;
    return mapAgent(result.rows[0]);
  }

  async ingest(agentId: string, payload: AgentMetricsPayload): Promise<Agent> {
    const cpu = payload.cpu?.usage_pct ?? null;
    const mem = payload.memory?.usage_pct ?? null;
    const swap = payload.swap?.usage_pct ?? null;
    const disk =
      payload.disks && payload.disks.length > 0
        ? Math.max(...payload.disks.map((d) => d.usage_pct))
        : null;
    const temp = payload.temperature_c ?? null;
    const load1 = payload.cpu?.load_avg?.[0] ?? null;

    await query(
      `UPDATE agents
       SET hostname = COALESCE($2, hostname),
           agent_version = COALESCE($3, agent_version),
           os_info = COALESCE($4::jsonb, os_info),
           latest_metrics = $5::jsonb,
           last_seen_at = NOW(),
           status = 'online',
           updated_at = NOW()
       WHERE id = $1`,
      [
        agentId,
        payload.hostname ?? null,
        payload.version ?? null,
        payload.os ? JSON.stringify(payload.os) : null,
        JSON.stringify(payload),
      ]
    );

    await query(
      `INSERT INTO agent_snapshots
         (agent_id, cpu_pct, mem_pct, swap_pct, disk_pct, temperature_c, load_1, metrics)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [
        agentId,
        cpu,
        mem,
        swap,
        disk,
        temp,
        load1,
        JSON.stringify(payload),
      ]
    );

    // retenção simples: manter ~7 dias
    await query(
      `DELETE FROM agent_snapshots
       WHERE agent_id = $1
         AND collected_at < NOW() - INTERVAL '7 days'`,
      [agentId]
    );

    const result = await query(`SELECT * FROM agents WHERE id = $1`, [agentId]);
    const agent = mapAgent(result.rows[0]);

    realtimeHub.publish(agent.user_id, {
      type: 'agent.updated',
      payload: {
        agent_id: agent.id,
        name: agent.name,
        status: agent.status,
        cpu_pct: cpu,
        mem_pct: mem,
      },
    });

    return agent;
  }
}
