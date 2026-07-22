import type { CheckType } from '@analytic-pulse/shared';
import { createClient, handleError, printJson, printTable } from '../util.js';

type GlobalFlags = { apiUrl?: string; apiKey?: string; json?: boolean };

export async function monitorList(flags: GlobalFlags): Promise<void> {
  try {
    const client = createClient(flags);
    const monitors = await client.listMonitors();
    if (flags.json) {
      printJson(monitors);
      return;
    }
    if (!monitors.length) {
      console.log('Nenhum monitor.');
      return;
    }
    printTable(
      ['ID', 'Name', 'Status', 'Type', 'URL'],
      monitors.map((m) => [
        m.id.slice(0, 8),
        m.name,
        m.status,
        m.check_type || 'http',
        m.url,
      ])
    );
  } catch (err) {
    handleError(err, flags.json);
  }
}

export async function monitorGet(
  id: string,
  flags: GlobalFlags & { metrics?: boolean }
): Promise<void> {
  try {
    const client = createClient(flags);
    const monitor = await client.getMonitor(id);
    if (flags.metrics) {
      const metrics = await client.getMonitorMetrics(id);
      if (flags.json) {
        printJson({ monitor, metrics });
        return;
      }
      console.log(JSON.stringify({ monitor, metrics }, null, 2));
      return;
    }
    if (flags.json) printJson(monitor);
    else console.log(JSON.stringify(monitor, null, 2));
  } catch (err) {
    handleError(err, flags.json);
  }
}

export async function monitorCreate(
  flags: GlobalFlags & {
    name: string;
    url: string;
    type?: string;
    interval?: string;
  }
): Promise<void> {
  try {
    const client = createClient(flags);
    const created = await client.createMonitor({
      name: flags.name,
      url: flags.url,
      check_type: (flags.type || 'https') as CheckType,
      interval_minutes: flags.interval ? Number(flags.interval) : 5,
    });
    if (flags.json) printJson(created);
    else {
      console.log(`Criado ${created.id}`);
      console.log(`${created.name} → ${created.url}`);
    }
  } catch (err) {
    handleError(err, flags.json);
  }
}

export async function monitorDelete(
  id: string,
  flags: GlobalFlags & { yes?: boolean }
): Promise<void> {
  try {
    if (!flags.yes) {
      console.error('Confirme com --yes para apagar o monitor.');
      process.exit(1);
    }
    const client = createClient(flags);
    await client.deleteMonitor(id);
    if (flags.json) printJson({ ok: true, id });
    else console.log(`Removido ${id}`);
  } catch (err) {
    handleError(err, flags.json);
  }
}
