#!/usr/bin/env node
import { collectMetrics } from './collect.js';

const VERSION = '0.1.0';

function env(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback;
}

async function pushOnce(apiUrl: string, token: string) {
  const payload = await collectMetrics(VERSION);
  const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/agents/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ingest failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as { ok?: boolean };
  console.log(
    `[pulse-agent] pushed ${payload.hostname} cpu=${payload.cpu?.usage_pct}% mem=${payload.memory?.usage_pct}%`
  );
  return json;
}

async function main() {
  const apiUrl = env('PULSE_API_URL', env('API_URL', 'http://localhost:3001'));
  const token = env('PULSE_AGENT_TOKEN', env('AGENT_TOKEN'));
  const intervalSec = Number(env('PULSE_AGENT_INTERVAL', '30'));

  if (!token) {
    console.error(
      'Defina PULSE_AGENT_TOKEN (token gerado em /agents no dashboard).'
    );
    process.exit(1);
  }

  console.log(
    `[pulse-agent] v${VERSION} → ${apiUrl} a cada ${intervalSec}s`
  );

  const tick = async () => {
    try {
      await pushOnce(apiUrl, token);
    } catch (err) {
      console.error(
        '[pulse-agent] erro:',
        err instanceof Error ? err.message : err
      );
    }
  };

  await tick();
  setInterval(tick, Math.max(10, intervalSec) * 1000);
}

main();
