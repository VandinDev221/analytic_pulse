import { PulseClient, PulseApiError } from '@analytic-pulse/sdk';
import { resolveConfig } from './config.js';

export function createClient(flags?: { apiUrl?: string; apiKey?: string }): PulseClient {
  const cfg = resolveConfig(flags);
  return new PulseClient({
    baseUrl: cfg.baseUrl,
    apiKey: cfg.apiKey,
  });
}

export function handleError(err: unknown, json = false): never {
  if (err instanceof PulseApiError) {
    if (json) {
      console.error(JSON.stringify({ error: err.message, status: err.status, code: err.code }));
    } else {
      console.error(`Erro ${err.status}: ${err.message}${err.code ? ` (${err.code})` : ''}`);
    }
    process.exit(1);
  }
  const message = err instanceof Error ? err.message : String(err);
  if (json) {
    console.error(JSON.stringify({ error: message }));
  } else {
    console.error(message);
  }
  process.exit(1);
}

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function printTable(headers: string[], rows: string[][]): void {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] || '').length))
  );
  const line = (cols: string[]) =>
    cols.map((c, i) => (c || '').padEnd(widths[i]!)).join('  ');
  console.log(line(headers));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const row of rows) console.log(line(row));
}
