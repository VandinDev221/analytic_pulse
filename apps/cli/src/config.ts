import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type PulseConfig = {
  baseUrl: string;
  apiKey: string;
};

function configDir(): string {
  const custom = process.env.PULSE_CONFIG_DIR;
  if (custom) return custom;
  return path.join(os.homedir(), '.pulse');
}

export function configPath(): string {
  const custom = process.env.PULSE_CONFIG_PATH;
  if (custom) return custom;
  return path.join(configDir(), 'config.json');
}

export function loadConfigFile(): PulseConfig | null {
  const file = configPath();
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<PulseConfig>;
    if (!raw.baseUrl || !raw.apiKey) return null;
    return { baseUrl: String(raw.baseUrl), apiKey: String(raw.apiKey) };
  } catch {
    return null;
  }
}

export function saveConfig(config: PulseConfig): void {
  const dir = path.dirname(configPath());
  fs.mkdirSync(dir, { recursive: true });
  const file = configPath();
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* windows */
  }
}

export function clearConfig(): void {
  const file = configPath();
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

/** Precedência: flags → env → arquivo */
export function resolveConfig(flags?: {
  apiUrl?: string;
  apiKey?: string;
}): PulseConfig {
  const file = loadConfigFile();
  const baseUrl = (
    flags?.apiUrl ||
    process.env.PULSE_API_URL ||
    file?.baseUrl ||
    ''
  ).replace(/\/$/, '');
  const apiKey =
    flags?.apiKey || process.env.PULSE_API_KEY || file?.apiKey || '';

  if (!baseUrl || !apiKey) {
    throw new Error(
      'Não autenticado. Rode `pulse login` ou defina PULSE_API_URL e PULSE_API_KEY.'
    );
  }
  return { baseUrl, apiKey };
}

export function maskKey(apiKey: string): string {
  if (apiKey.length <= 12) return '***';
  return `${apiKey.slice(0, 10)}…${apiKey.slice(-4)}`;
}
