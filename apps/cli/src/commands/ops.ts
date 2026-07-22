import { createClient, handleError, printJson, printTable } from '../util.js';

type GlobalFlags = { apiUrl?: string; apiKey?: string; json?: boolean };

export async function runStatus(flags: GlobalFlags): Promise<void> {
  try {
    const client = createClient(flags);
    const overview = await client.getDashboardOverview();
    if (flags.json) {
      printJson(overview);
      return;
    }
    const s = overview.summary;
    console.log('Status (dashboard)');
    console.log(
      `  Monitores: ${s.monitors_total} (up ${s.monitors_up} / down ${s.monitors_down} / unknown ${s.monitors_unknown})`
    );
    console.log(
      `  Uptime 7d: ${s.overall_uptime_7d != null ? `${s.overall_uptime_7d.toFixed(2)}%` : '—'}`
    );
    console.log(
      `  Latência 7d: ${s.avg_latency_7d != null ? `${Math.round(s.avg_latency_7d)}ms` : '—'}`
    );
    console.log(`  Incidentes abertos: ${s.open_incidents}`);
    if (overview.top_latencies?.length) {
      console.log('\nTop latências:');
      printTable(
        ['Monitor', 'ms'],
        overview.top_latencies.slice(0, 5).map((t) => [
          t.name,
          String(Math.round(t.avg_latency_7d)),
        ])
      );
    }
  } catch (err) {
    handleError(err, flags.json);
  }
}

export async function runIncidents(
  flags: GlobalFlags & { status?: string }
): Promise<void> {
  try {
    const client = createClient(flags);
    const status = (flags.status || 'active') as
      | 'active'
      | 'all'
      | 'open'
      | 'acknowledged'
      | 'investigating'
      | 'resolved';
    const list = await client.listIncidents(status);
    if (flags.json) {
      printJson(list);
      return;
    }
    if (!list.length) {
      console.log('Nenhum incidente.');
      return;
    }
    printTable(
      ['ID', 'Status', 'Severity', 'Title'],
      list.map((i) => [
        i.id.slice(0, 8),
        i.status,
        i.severity || '—',
        i.title || '—',
      ])
    );
  } catch (err) {
    handleError(err, flags.json);
  }
}

export async function runIncidentGet(id: string, flags: GlobalFlags): Promise<void> {
  try {
    const client = createClient(flags);
    const detail = await client.getIncident(id);
    if (flags.json) printJson(detail);
    else console.log(JSON.stringify(detail, null, 2));
  } catch (err) {
    handleError(err, flags.json);
  }
}

export async function runSsl(flags: GlobalFlags): Promise<void> {
  try {
    const client = createClient(flags);
    const overview = await client.getSslOverview();
    if (flags.json) {
      printJson(overview);
      return;
    }
    const s = overview.summary;
    console.log(
      `SSL: total ${s.total} · ok ${s.ok} · warning ${s.warning} · critical ${s.critical} · expired ${s.expired}`
    );
    if (!overview.certificates?.length) return;
    printTable(
      ['Monitor', 'Host', 'Health', 'Days'],
      overview.certificates.slice(0, 30).map((c) => [
        c.name,
        c.host || '—',
        c.health,
        c.days_remaining != null ? String(c.days_remaining) : '—',
      ])
    );
  } catch (err) {
    handleError(err, flags.json);
  }
}

export async function runDeploy(
  flags: GlobalFlags & { url?: string }
): Promise<void> {
  try {
    const client = createClient(flags);

    if (flags.url) {
      const started = Date.now();
      const res = await fetch(flags.url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(15_000),
      });
      const ms = Date.now() - started;
      const data = {
        url: flags.url,
        status: res.status,
        ok: res.ok,
        latency_ms: ms,
      };
      if (flags.json) printJson(data);
      else {
        console.log(`Deploy smoke: ${flags.url}`);
        console.log(`  HTTP ${res.status} · ${ms}ms · ${res.ok ? 'ok' : 'fail'}`);
      }
      if (!res.ok) process.exit(1);
      return;
    }

    const [dashboard, analytics, incidents] = await Promise.all([
      client.getDashboardOverview(),
      client.getAnalyticsOverview('24h').catch(() => null),
      client.listIncidents('active'),
    ]);

    const data = {
      summary: dashboard.summary,
      analytics: analytics?.summary ?? null,
      active_incidents: incidents.length,
    };

    if (flags.json) {
      printJson(data);
      return;
    }

    console.log('Deploy health (últimas 24h / status atual)');
    console.log(
      `  Monitores up/down: ${dashboard.summary.monitors_up}/${dashboard.summary.monitors_down}`
    );
    console.log(`  Incidentes ativos: ${incidents.length}`);
    if (analytics?.summary) {
      console.log(
        `  Disponibilidade: ${
          analytics.summary.availability_pct != null
            ? `${analytics.summary.availability_pct.toFixed(2)}%`
            : '—'
        }`
      );
    }
    if (incidents.length > 0) {
      console.log('\nAtenção: há incidentes ativos — revise antes de promover.');
      process.exitCode = 2;
    } else {
      console.log('\nSem incidentes ativos.');
    }
  } catch (err) {
    handleError(err, flags.json);
  }
}
