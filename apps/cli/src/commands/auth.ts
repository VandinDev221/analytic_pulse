import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { PulseClient } from '@analytic-pulse/sdk';
import {
  clearConfig,
  configPath,
  loadConfigFile,
  maskKey,
  saveConfig,
} from '../config.js';
import { handleError, printJson } from '../util.js';

async function ask(rl: readline.Interface, q: string, fallback = ''): Promise<string> {
  const hint = fallback ? ` [${fallback}]` : '';
  const answer = (await rl.question(`${q}${hint}: `)).trim();
  return answer || fallback;
}

export async function runLogin(opts: {
  apiUrl?: string;
  apiKey?: string;
  json?: boolean;
}): Promise<void> {
  try {
    let baseUrl = opts.apiUrl?.replace(/\/$/, '') || '';
    let apiKey = opts.apiKey || '';

    if (!baseUrl || !apiKey) {
      const rl = readline.createInterface({ input, output });
      try {
        const existing = loadConfigFile();
        if (!baseUrl) {
          baseUrl = await ask(
            rl,
            'API URL',
            existing?.baseUrl || process.env.PULSE_API_URL || 'http://localhost:3001'
          );
        }
        if (!apiKey) {
          apiKey = await ask(rl, 'API Key (ap_pk_…)');
        }
      } finally {
        rl.close();
      }
    }

    baseUrl = baseUrl.replace(/\/$/, '');
    if (!apiKey.startsWith('ap_pk_')) {
      throw new Error('API key inválida — deve começar com ap_pk_ (crie em /api-keys)');
    }

    const client = new PulseClient({ baseUrl, apiKey });
    await client.getDashboardOverview();
    saveConfig({ baseUrl, apiKey });

    if (opts.json) {
      printJson({ ok: true, baseUrl, apiKey: maskKey(apiKey), config: configPath() });
    } else {
      console.log(`Autenticado em ${baseUrl}`);
      console.log(`Chave ${maskKey(apiKey)}`);
      console.log(`Config salva em ${configPath()}`);
    }
  } catch (err) {
    handleError(err, opts.json);
  }
}

export function runLogout(opts: { json?: boolean }): void {
  clearConfig();
  if (opts.json) {
    printJson({ ok: true });
  } else {
    console.log('Sessão removida.');
  }
}

export function runWhoami(opts: { json?: boolean }): void {
  try {
    const file = loadConfigFile();
    const baseUrl = process.env.PULSE_API_URL || file?.baseUrl || null;
    const apiKey = process.env.PULSE_API_KEY || file?.apiKey || null;
    if (!baseUrl || !apiKey) {
      throw new Error('Não autenticado. Rode `pulse login`.');
    }
    const data = {
      baseUrl,
      apiKey: maskKey(apiKey),
      config: configPath(),
      source: process.env.PULSE_API_KEY
        ? 'env'
        : file
          ? 'file'
          : 'unknown',
    };
    if (opts.json) printJson(data);
    else {
      console.log(`URL    ${data.baseUrl}`);
      console.log(`Key    ${data.apiKey}`);
      console.log(`Config ${data.config}`);
      console.log(`Source ${data.source}`);
    }
  } catch (err) {
    handleError(err, opts.json);
  }
}
