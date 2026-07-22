#!/usr/bin/env node
import { Command } from 'commander';
import { runLogin, runLogout, runWhoami } from './commands/auth.js';
import {
  monitorCreate,
  monitorDelete,
  monitorGet,
  monitorList,
} from './commands/monitor.js';
import {
  runDeploy,
  runIncidentGet,
  runIncidents,
  runSsl,
  runStatus,
} from './commands/ops.js';

const program = new Command();

program
  .name('pulse')
  .description('Analytic Pulse CLI — API pública /api/v1')
  .version('0.1.0')
  .option('--api-url <url>', 'Override PULSE_API_URL')
  .option('--api-key <key>', 'Override PULSE_API_KEY')
  .option('--json', 'Saída JSON', false);

function globals() {
  const o = program.opts<{
    apiUrl?: string;
    apiKey?: string;
    json?: boolean;
  }>();
  return { apiUrl: o.apiUrl, apiKey: o.apiKey, json: Boolean(o.json) };
}

program
  .command('login')
  .description('Salva API URL + chave ap_pk_… em ~/.pulse/config.json')
  .option('--api-url <url>')
  .option('--api-key <key>')
  .action(async (opts) => {
    const g = globals();
    await runLogin({
      apiUrl: opts.apiUrl || g.apiUrl,
      apiKey: opts.apiKey || g.apiKey,
      json: g.json,
    });
  });

program
  .command('logout')
  .description('Remove credenciais locais')
  .action(() => runLogout(globals()));

program
  .command('whoami')
  .description('Mostra URL e prefixo da chave')
  .action(() => runWhoami(globals()));

const monitor = program
  .command('monitor')
  .description('Gerenciar monitores');

monitor
  .command('list')
  .description('Listar monitores')
  .action(async () => monitorList(globals()));

monitor
  .command('get')
  .argument('<id>', 'Monitor ID')
  .option('--metrics', 'Incluir métricas', false)
  .action(async (id: string, opts: { metrics?: boolean }) =>
    monitorGet(id, { ...globals(), metrics: opts.metrics })
  );

monitor
  .command('create')
  .requiredOption('--name <name>')
  .requiredOption('--url <url>')
  .option('--type <check_type>', 'http|https|tcp|ping|dns|ssl', 'https')
  .option('--interval <minutes>', 'Intervalo em minutos', '5')
  .action(
    async (opts: {
      name: string;
      url: string;
      type?: string;
      interval?: string;
    }) => monitorCreate({ ...globals(), ...opts })
  );

monitor
  .command('delete')
  .argument('<id>', 'Monitor ID')
  .option('-y, --yes', 'Confirmar', false)
  .action(async (id: string, opts: { yes?: boolean }) =>
    monitorDelete(id, { ...globals(), yes: opts.yes })
  );

program
  .command('status')
  .description('Resumo do dashboard')
  .action(async () => runStatus(globals()));

const incidents = program
  .command('incidents')
  .description('Listar incidentes')
  .option(
    '--status <status>',
    'active|all|open|acknowledged|investigating|resolved',
    'active'
  )
  .action(async (opts: { status?: string }) =>
    runIncidents({ ...globals(), status: opts.status })
  );

incidents
  .command('get')
  .argument('<id>')
  .action(async (id: string) => runIncidentGet(id, globals()));

program
  .command('ssl')
  .description('Visão SSL / certificados')
  .action(async () => runSsl(globals()));

program
  .command('deploy')
  .description('Smoke check de URL ou health do ambiente')
  .option('--url <url>', 'HTTP GET de smoke test')
  .action(async (opts: { url?: string }) =>
    runDeploy({ ...globals(), url: opts.url })
  );

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
