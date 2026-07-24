#!/usr/bin/env node
/**
 * Modo probe: busca jobs da região e executa checks HTTP/HTTPS.
 * PULSE_AGENT_MODE=probe PULSE_AGENT_TOKEN=... PULSE_API_URL=... npm start
 */

interface ProbeJob {
  id: string;
  name: string;
  url: string;
  method: string;
  check_type: string;
  keyword?: string | null;
  expected_status_codes?: number[] | null;
}

interface ProbeResult {
  monitor_id: string;
  status_code: number | null;
  response_time_ms: number;
  is_up: boolean;
  error_message?: string | null;
  check_type?: string;
}

async function runHttpJob(job: ProbeJob): Promise<ProbeResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(job.url, {
      method: job.method || 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'PingPulseProbe/1.0' },
    });
    const body = await res.text();
    const ms = Date.now() - started;

    let isUp = res.status < 400;
    let error: string | null = null;

    if (job.expected_status_codes && job.expected_status_codes.length > 0) {
      isUp = job.expected_status_codes.includes(res.status);
      if (!isUp) error = `UNEXPECTED_STATUS_${res.status}`;
    }

    if (isUp && job.keyword && job.check_type !== 'browser') {
      if (!body.includes(job.keyword)) {
        isUp = false;
        error = 'KEYWORD_NOT_FOUND';
      }
    }

    return {
      monitor_id: job.id,
      status_code: res.status,
      response_time_ms: ms,
      is_up: isUp,
      error_message: error,
      check_type: job.check_type,
    };
  } catch (err) {
    return {
      monitor_id: job.id,
      status_code: null,
      response_time_ms: Date.now() - started,
      is_up: false,
      error_message:
        err instanceof Error ? err.message.substring(0, 255) : 'PROBE_FETCH_FAILED',
      check_type: job.check_type,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runProbeLoop(
  apiUrl: string,
  token: string,
  intervalSec: number
): Promise<void> {
  const base = apiUrl.replace(/\/$/, '');
  console.log(`[pulse-probe] claiming jobs every ${intervalSec}s from ${base}`);

  const tick = async () => {
    try {
      const jobsRes = await fetch(`${base}/api/agents/probe/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!jobsRes.ok) {
        throw new Error(`jobs HTTP ${jobsRes.status}`);
      }
      const payload = (await jobsRes.json()) as {
        region_code: string;
        jobs: ProbeJob[];
      };
      console.log(
        `[pulse-probe] region=${payload.region_code} jobs=${payload.jobs.length}`
      );

      if (payload.jobs.length === 0) return;

      const results: ProbeResult[] = [];
      for (const job of payload.jobs) {
        const result = await runHttpJob(job);
        results.push(result);
        console.log(
          `[pulse-probe] ${job.name} -> ${result.is_up ? 'UP' : 'DOWN'} ${result.response_time_ms}ms`
        );
      }

      const submit = await fetch(`${base}/api/agents/probe/results`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ results }),
      });
      if (!submit.ok) {
        throw new Error(`results HTTP ${submit.status}`);
      }
    } catch (err) {
      console.error(
        '[pulse-probe] erro:',
        err instanceof Error ? err.message : err
      );
    }
  };

  await tick();
  setInterval(tick, Math.max(15, intervalSec) * 1000);
}
