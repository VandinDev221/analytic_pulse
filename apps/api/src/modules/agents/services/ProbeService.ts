import type {
  CheckResult,
  ProbeCheckResultInput,
  ProbeJobMonitor,
  ProbeJobsResponse,
} from '@analytic-pulse/shared';
import { ValidationError } from '@analytic-pulse/shared';
import { env } from '../../../config/env';
import { query } from '../../../infrastructure/db';
import { emptyTimings } from '../../monitoring/checkers/types';
import { CheckOrchestrator } from '../../monitoring/services/CheckOrchestrator';
import { PgMonitorRepository } from '../../monitoring/repositories/PgMonitorRepository';
import { AgentService } from './AgentService';
import { realtimeHub } from '../../realtime';

export class ProbeService {
  private readonly agents = new AgentService();
  private readonly monitors = new PgMonitorRepository();
  private readonly orchestrator = new CheckOrchestrator(this.monitors);

  async claimJobs(agentId: string): Promise<ProbeJobsResponse> {
    const agent = await this.agents.findByIdInternal(agentId);
    if (!agent) throw new ValidationError('Agent not found');
    if (agent.kind !== 'probe') {
      throw new ValidationError('Agent is not a probe');
    }
    if (!agent.region_code) {
      throw new ValidationError('Probe agent requires region_code');
    }

    await this.agents.touch(agentId);

    const result = await query(
      `SELECT id, name, url, method, check_type, host, port, keyword,
              expected_status_codes, interval_minutes, region_code,
              last_checked_at
       FROM monitors
       WHERE user_id = $1
         AND status != 'inactive'
         AND COALESCE(region_code, 'gru') = $2
       ORDER BY COALESCE(last_checked_at, '1970-01-01'::timestamptz) ASC
       LIMIT 25`,
      [agent.user_id, agent.region_code]
    );

    const jobs: ProbeJobMonitor[] = [];
    for (const row of result.rows as Record<string, unknown>[]) {
      const interval = Number(row.interval_minutes ?? 5);
      const last = row.last_checked_at
        ? new Date(row.last_checked_at as string).getTime()
        : 0;
      const due = Date.now() - last >= interval * 60_000 * 0.9;
      if (!due && last > 0) continue;

      jobs.push({
        id: row.id as string,
        name: row.name as string,
        url: row.url as string,
        method: (row.method as string) || 'GET',
        check_type: (row.check_type as ProbeJobMonitor['check_type']) || 'http',
        host: (row.host as string | null) ?? null,
        port: row.port != null ? Number(row.port) : null,
        keyword: (row.keyword as string | null) ?? null,
        expected_status_codes: Array.isArray(row.expected_status_codes)
          ? (row.expected_status_codes as number[])
          : null,
        interval_minutes: interval,
        region_code: (row.region_code as string) || agent.region_code,
      });
    }

    return {
      agent_id: agent.id,
      region_code: agent.region_code,
      jobs,
    };
  }

  async submitResults(
    agentId: string,
    results: ProbeCheckResultInput[]
  ): Promise<{ processed: number }> {
    const agent = await this.agents.findByIdInternal(agentId);
    if (!agent || agent.kind !== 'probe' || !agent.region_code) {
      throw new ValidationError('Invalid probe agent');
    }
    await this.agents.touch(agentId);

    let processed = 0;
    for (const item of results) {
      const monitor = await this.monitors.findByIdForUser(
        item.monitor_id,
        agent.user_id
      );
      if (!monitor) continue;

      const checkType = item.check_type || monitor.check_type || 'http';
      const result: CheckResult = {
        status_code: item.status_code,
        response_time_ms: Math.round(item.response_time_ms),
        is_up: Boolean(item.is_up),
        error_message: item.error_message?.substring(0, 255) ?? null,
        check_type: checkType,
        timings: emptyTimings(Math.round(item.response_time_ms)),
        response_size_bytes: null,
        content_length: null,
        response_headers: null,
        redirect_chain: null,
        meta: {
          probe_region: agent.region_code,
          probe_agent_id: agent.id,
        },
      };

      await this.orchestrator.applyExternalCheck(
        {
          ...monitor,
          user_id: agent.user_id,
          status: monitor.status,
        },
        result,
        agent.region_code
      );
      processed += 1;
    }

    realtimeHub.publish(agent.user_id, {
      type: 'ping.cycle',
      payload: {
        source: 'probe',
        region: agent.region_code,
        processed,
      },
    });

    return { processed };
  }

  defaultRegion(): string {
    return env.defaultProbeRegion;
  }
}
