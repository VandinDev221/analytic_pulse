import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import { promisify } from 'util';
import type { AgentMetricsPayload } from '@analytic-pulse/shared';

const execFileAsync = promisify(execFile);

function readFileSafe(path: string): string | null {
  try {
    return fs.readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function parseMeminfo(): {
  total: number;
  available: number;
  swapTotal: number;
  swapFree: number;
} {
  const raw = readFileSafe('/proc/meminfo') || '';
  const get = (key: string) => {
    const m = raw.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'));
    return m ? Number(m[1]) * 1024 : 0;
  };
  return {
    total: get('MemTotal'),
    available: get('MemAvailable') || get('MemFree'),
    swapTotal: get('SwapTotal'),
    swapFree: get('SwapFree'),
  };
}

function cpuTimes(): { idle: number; total: number } {
  const raw = readFileSafe('/proc/stat') || '';
  const line = raw.split('\n').find((l) => l.startsWith('cpu '));
  if (!line) return { idle: 0, total: 0 };
  const parts = line.trim().split(/\s+/).slice(1).map(Number);
  const idle = (parts[3] || 0) + (parts[4] || 0);
  const total = parts.reduce((a, b) => a + b, 0);
  return { idle, total };
}

async function sampleCpuUsagePct(): Promise<number> {
  const a = cpuTimes();
  await new Promise((r) => setTimeout(r, 250));
  const b = cpuTimes();
  const idleDelta = b.idle - a.idle;
  const totalDelta = b.total - a.total;
  if (totalDelta <= 0) return 0;
  return Number((100 * (1 - idleDelta / totalDelta)).toFixed(2));
}

function readTemperatureC(): number | null {
  const thermal = '/sys/class/thermal';
  try {
    const zones = fs.readdirSync(thermal).filter((z) => z.startsWith('thermal_zone'));
    for (const zone of zones) {
      const type = readFileSafe(`${thermal}/${zone}/type`)?.trim() || '';
      if (/cpu|pkg|x86/i.test(type) || zones.length === 1) {
        const temp = Number(readFileSafe(`${thermal}/${zone}/temp`));
        if (Number.isFinite(temp) && temp > 0) {
          return Number((temp / 1000).toFixed(1));
        }
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function readDisks(): AgentMetricsPayload['disks'] {
  try {
    const out = fs.readFileSync('/proc/mounts', 'utf8');
    const mounts = out
      .split('\n')
      .map((l) => l.split(/\s+/))
      .filter((p) => p.length >= 3)
      .filter((p) => ['/', '/home', '/var', '/data'].includes(p[1]!))
      .map((p) => ({ mount: p[1]!, fs: p[2]! }));

    const uniq = new Map<string, { mount: string; fs: string }>();
    for (const m of mounts) uniq.set(m.mount, m);

    const disks: NonNullable<AgentMetricsPayload['disks']> = [];
    for (const m of uniq.values()) {
      try {
        // Node 18.15+ / 19.6+
        const st = (fs as typeof fs & {
          statfsSync?: (path: string) => {
            blocks: number | bigint;
            bsize: number | bigint;
            bavail: number | bigint;
          };
        }).statfsSync?.(m.mount);
        if (!st) continue;
        const total = Number(st.blocks) * Number(st.bsize);
        const free = Number(st.bavail) * Number(st.bsize);
        const used = total - free;
        disks.push({
          mount: m.mount,
          fs: m.fs,
          total_bytes: total,
          used_bytes: used,
          usage_pct: total > 0 ? Number(((used / total) * 100).toFixed(2)) : 0,
        });
      } catch {
        /* skip mount */
      }
    }
    if (disks.length) return disks;
  } catch {
    /* fall through */
  }

  const total = os.totalmem();
  const free = os.freemem();
  return [
    {
      mount: '/',
      fs: null,
      total_bytes: total,
      used_bytes: total - free,
      usage_pct: Number((((total - free) / total) * 100).toFixed(2)),
    },
  ];
}

function readNetwork(): AgentMetricsPayload['network'] {
  const raw = readFileSafe('/proc/net/dev');
  if (!raw) return [];
  return raw
    .split('\n')
    .slice(2)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [ifacePart, rest] = line.split(':');
      const iface = (ifacePart || '').trim();
      const nums = (rest || '').trim().split(/\s+/).map(Number);
      return {
        iface,
        rx_bytes: nums[0] || 0,
        tx_bytes: nums[8] || 0,
      };
    })
    .filter((n) => n.iface && n.iface !== 'lo');
}

async function collectDocker(): Promise<NonNullable<AgentMetricsPayload['docker']>> {
  const empty = {
    available: false,
    containers: [] as NonNullable<AgentMetricsPayload['containers']>,
    volumes: [] as NonNullable<NonNullable<AgentMetricsPayload['docker']>['volumes']>,
    networks: [] as NonNullable<NonNullable<AgentMetricsPayload['docker']>['networks']>,
    logs: [] as NonNullable<NonNullable<AgentMetricsPayload['docker']>['logs']>,
  };

  try {
    await execFileAsync('docker', ['info', '--format', '{{.ServerVersion}}'], {
      timeout: 2500,
    });
  } catch {
    return empty;
  }

  const containers: NonNullable<AgentMetricsPayload['containers']> = [];
  const statsMap = new Map<
    string,
    { cpu: number; memUsage: number; memLimit: number; memPct: number }
  >();

  try {
    const { stdout: statsOut } = await execFileAsync(
      'docker',
      [
        'stats',
        '--no-stream',
        '--format',
        '{{.ID}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}',
      ],
      { timeout: 8000 }
    );
    for (const line of statsOut.trim().split('\n').filter(Boolean)) {
      const [id, cpuPerc, memUsage, memPerc] = line.split('\t');
      if (!id) continue;
      const cpu = Number(String(cpuPerc || '0').replace('%', '')) || 0;
      const memPct = Number(String(memPerc || '0').replace('%', '')) || 0;
      const usagePart = String(memUsage || '').split('/')[0]?.trim() || '0';
      const limitPart = String(memUsage || '').split('/')[1]?.trim() || '0';
      statsMap.set(id.slice(0, 12), {
        cpu,
        memUsage: parseDockerSize(usagePart),
        memLimit: parseDockerSize(limitPart),
        memPct,
      });
    }
  } catch {
    /* stats optional */
  }

  try {
    const { stdout } = await execFileAsync(
      'docker',
      [
        'ps',
        '-a',
        '--format',
        '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.State}}\t{{.Ports}}\t{{.CreatedAt}}',
      ],
      { timeout: 5000 }
    );

    for (const line of stdout.trim().split('\n').filter(Boolean)) {
      const [id, name, image, status, state, ports, ...createdParts] =
        line.split('\t');
      const shortId = (id || '').slice(0, 12);
      const stats = statsMap.get(shortId);
      let restartCount: number | null = null;
      try {
        const { stdout: inspectOut } = await execFileAsync(
          'docker',
          ['inspect', '-f', '{{.RestartCount}}', id || ''],
          { timeout: 2000 }
        );
        const n = Number(inspectOut.trim());
        restartCount = Number.isFinite(n) ? n : null;
      } catch {
        restartCount = null;
      }

      containers.push({
        id: shortId,
        name: name || '',
        image: image || '',
        status: status || '',
        state: state || null,
        cpu_pct: stats?.cpu ?? null,
        mem_usage_bytes: stats?.memUsage ?? null,
        mem_limit_bytes: stats?.memLimit ?? null,
        mem_pct: stats?.memPct ?? null,
        restart_count: restartCount,
        ports: ports || null,
        created_at: createdParts.join('\t') || null,
      });
    }
  } catch {
    return { ...empty, available: true };
  }

  const volumes: NonNullable<NonNullable<AgentMetricsPayload['docker']>['volumes']> =
    [];
  try {
    const { stdout } = await execFileAsync(
      'docker',
      ['volume', 'ls', '--format', '{{.Name}}\t{{.Driver}}\t{{.Mountpoint}}'],
      { timeout: 4000 }
    );
    for (const line of stdout.trim().split('\n').filter(Boolean)) {
      const [name, driver, mountpoint] = line.split('\t');
      volumes.push({
        name: name || '',
        driver: driver || '',
        mountpoint: mountpoint || null,
      });
    }
  } catch {
    /* optional */
  }

  const networks: NonNullable<
    NonNullable<AgentMetricsPayload['docker']>['networks']
  > = [];
  try {
    const { stdout } = await execFileAsync(
      'docker',
      [
        'network',
        'ls',
        '--format',
        '{{.ID}}\t{{.Name}}\t{{.Driver}}\t{{.Scope}}',
      ],
      { timeout: 4000 }
    );
    for (const line of stdout.trim().split('\n').filter(Boolean)) {
      const [id, name, driver, scope] = line.split('\t');
      networks.push({
        id: (id || '').slice(0, 12),
        name: name || '',
        driver: driver || '',
        scope: scope || null,
      });
    }
  } catch {
    /* optional */
  }

  const logs: NonNullable<NonNullable<AgentMetricsPayload['docker']>['logs']> =
    [];
  const running = containers
    .filter((c) => (c.state || '').toLowerCase() === 'running')
    .slice(0, 5);
  for (const c of running) {
    try {
      const { stdout } = await execFileAsync(
        'docker',
        ['logs', '--tail', '20', c.id],
        { timeout: 3000 }
      );
      logs.push({
        container: c.name,
        container_id: c.id,
        lines: stdout.trim().split('\n').filter(Boolean).slice(-20),
      });
    } catch {
      /* skip */
    }
  }

  return {
    available: true,
    containers,
    volumes,
    networks,
    logs,
  };
}

function parseDockerSize(raw: string): number {
  const m = raw.trim().match(/^([\d.]+)\s*([KMGT]?i?B)$/i);
  if (!m) return 0;
  const n = Number(m[1]);
  const unit = (m[2] || 'B').toUpperCase();
  const mult: Record<string, number> = {
    B: 1,
    KB: 1e3,
    MB: 1e6,
    GB: 1e9,
    TB: 1e12,
    KIB: 1024,
    MIB: 1024 ** 2,
    GIB: 1024 ** 3,
    TIB: 1024 ** 4,
  };
  return Math.round(n * (mult[unit] || 1));
}

function ageFromTimestamp(ts?: string | null): string | null {
  if (!ts) return null;
  const ms = Date.now() - new Date(ts).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

async function kubectlJson(args: string[], timeout = 8000): Promise<unknown | null> {
  try {
    const { stdout } = await execFileAsync('kubectl', args, {
      timeout,
      maxBuffer: 8 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

async function collectKubernetes(): Promise<
  NonNullable<AgentMetricsPayload['kubernetes']>
> {
  const empty: NonNullable<AgentMetricsPayload['kubernetes']> = {
    available: false,
    context: null,
    pods: [],
    deployments: [],
    services: [],
    ingresses: [],
    nodes: [],
    namespaces: [],
    pvcs: [],
  };

  try {
    await execFileAsync('kubectl', ['version', '--client', '--output=json'], {
      timeout: 3000,
    });
  } catch {
    return empty;
  }

  let context: string | null = null;
  try {
    const { stdout } = await execFileAsync(
      'kubectl',
      ['config', 'current-context'],
      { timeout: 2000 }
    );
    context = stdout.trim() || null;
  } catch {
    context = null;
  }

  const nsProbe = await kubectlJson(['get', 'ns', '-o', 'json'], 5000);
  if (!nsProbe || typeof nsProbe !== 'object') {
    return { ...empty, context };
  }

  const [podsJson, deploysJson, svcJson, ingJson, nodesJson, pvcJson] =
    await Promise.all([
      kubectlJson(['get', 'pods', '-A', '-o', 'json'], 10000),
      kubectlJson(['get', 'deploy', '-A', '-o', 'json'], 8000),
      kubectlJson(['get', 'svc', '-A', '-o', 'json'], 8000),
      kubectlJson(['get', 'ingress', '-A', '-o', 'json'], 8000),
      kubectlJson(['get', 'nodes', '-o', 'json'], 8000),
      kubectlJson(['get', 'pvc', '-A', '-o', 'json'], 8000),
    ]);

  type KItem = {
    metadata?: {
      name?: string;
      namespace?: string;
      creationTimestamp?: string;
      labels?: Record<string, string>;
    };
    status?: Record<string, unknown>;
    spec?: Record<string, unknown>;
  };

  const items = (raw: unknown): KItem[] => {
    if (!raw || typeof raw !== 'object') return [];
    const arr = (raw as { items?: KItem[] }).items;
    return Array.isArray(arr) ? arr : [];
  };

  const pods = items(podsJson).map((p) => {
    const containerStatuses =
      (p.status?.containerStatuses as
        | Array<{ ready?: boolean; restartCount?: number }>
        | undefined) || [];
    const readyCount = containerStatuses.filter((c) => c.ready).length;
    const total = containerStatuses.length || 0;
    const restarts = containerStatuses.reduce(
      (sum, c) => sum + (c.restartCount || 0),
      0
    );
    return {
      name: p.metadata?.name || '',
      namespace: p.metadata?.namespace || 'default',
      status: String(p.status?.phase || 'Unknown'),
      ready: `${readyCount}/${total || '?'}`,
      restarts,
      node: (p.spec?.nodeName as string) || null,
      age: ageFromTimestamp(p.metadata?.creationTimestamp),
      ip: (p.status?.podIP as string) || null,
    };
  });

  const deployments = items(deploysJson).map((d) => {
    const ready = Number(d.status?.readyReplicas || 0);
    const desired = Number(
      (d.spec as { replicas?: number } | undefined)?.replicas ??
        d.status?.replicas ??
        0
    );
    return {
      name: d.metadata?.name || '',
      namespace: d.metadata?.namespace || 'default',
      ready: `${ready}/${desired}`,
      up_to_date: Number(d.status?.updatedReplicas || 0),
      available: Number(d.status?.availableReplicas || 0),
      age: ageFromTimestamp(d.metadata?.creationTimestamp),
    };
  });

  const services = items(svcJson).map((s) => {
    const ports = (
      (s.spec?.ports as Array<{
        port?: number;
        protocol?: string;
        nodePort?: number;
      }>) || []
    )
      .map((p) => {
        const base = `${p.port || '?'}/${p.protocol || 'TCP'}`;
        return p.nodePort ? `${base}:${p.nodePort}` : base;
      })
      .join(', ');
    const external = s.status?.loadBalancer as
      | { ingress?: Array<{ ip?: string; hostname?: string }> }
      | undefined;
    const extParts = (external?.ingress || [])
      .map((i) => i.ip || i.hostname)
      .filter(Boolean);
    const externalIPs = (s.spec?.externalIPs as string[] | undefined) || [];
    return {
      name: s.metadata?.name || '',
      namespace: s.metadata?.namespace || 'default',
      type: String(s.spec?.type || 'ClusterIP'),
      cluster_ip: (s.spec?.clusterIP as string) || null,
      external_ip:
        [...extParts, ...externalIPs].filter(Boolean).join(', ') || null,
      ports: ports || null,
      age: ageFromTimestamp(s.metadata?.creationTimestamp),
    };
  });

  const ingresses = items(ingJson).map((ing) => {
    const rules =
      ((ing.spec as { rules?: Array<{ host?: string }> })?.rules || [])
        .map((r) => r.host)
        .filter(Boolean)
        .join(', ') || null;
    const lbs = (
      (ing.status?.loadBalancer as {
        ingress?: Array<{ ip?: string; hostname?: string }>;
      })?.ingress || []
    )
      .map((i) => i.ip || i.hostname)
      .filter(Boolean)
      .join(', ');
    const className =
      (ing.spec as { ingressClassName?: string })?.ingressClassName ||
      ing.metadata?.labels?.['kubernetes.io/ingress.class'] ||
      null;
    return {
      name: ing.metadata?.name || '',
      namespace: ing.metadata?.namespace || 'default',
      class: className,
      hosts: rules,
      address: lbs || null,
      age: ageFromTimestamp(ing.metadata?.creationTimestamp),
    };
  });

  const nodes = items(nodesJson).map((n) => {
    const conditions =
      (n.status?.conditions as Array<{ type?: string; status?: string }>) || [];
    const ready = conditions.find((c) => c.type === 'Ready');
    const status =
      ready?.status === 'True' ? 'Ready' : ready ? 'NotReady' : 'Unknown';
    const roles =
      Object.keys(n.metadata?.labels || {})
        .filter((k) => k.startsWith('node-role.kubernetes.io/'))
        .map((k) => k.replace('node-role.kubernetes.io/', '') || 'node')
        .join(',') || 'worker';
    const capacity = n.status?.capacity as
      | { cpu?: string; memory?: string }
      | undefined;
    return {
      name: n.metadata?.name || '',
      status,
      roles,
      version:
        (n.status?.nodeInfo as { kubeletVersion?: string } | undefined)
          ?.kubeletVersion || null,
      age: ageFromTimestamp(n.metadata?.creationTimestamp),
      cpu: capacity?.cpu || null,
      memory: capacity?.memory || null,
    };
  });

  const namespaces = items(nsProbe).map((ns) => ({
    name: ns.metadata?.name || '',
    status: String(
      (ns.status as { phase?: string } | undefined)?.phase || 'Active'
    ),
    age: ageFromTimestamp(ns.metadata?.creationTimestamp),
  }));

  const pvcs = items(pvcJson).map((pvc) => ({
    name: pvc.metadata?.name || '',
    namespace: pvc.metadata?.namespace || 'default',
    status: String(pvc.status?.phase || 'Unknown'),
    volume: (pvc.spec?.volumeName as string) || null,
    capacity:
      (pvc.status?.capacity as { storage?: string } | undefined)?.storage ||
      null,
    storage_class: (pvc.spec?.storageClassName as string) || null,
    age: ageFromTimestamp(pvc.metadata?.creationTimestamp),
  }));

  return {
    available: true,
    context,
    pods,
    deployments,
    services,
    ingresses,
    nodes,
    namespaces,
    pvcs,
  };
}

async function readServices(): Promise<NonNullable<AgentMetricsPayload['services']>> {
  try {
    const { stdout } = await execFileAsync(
      'systemctl',
      [
        'list-units',
        '--type=service',
        '--state=running',
        '--no-pager',
        '--no-legend',
      ],
      { timeout: 3000 }
    );
    return stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .slice(0, 40)
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        return {
          name: (parts[0] || '').replace(/\.service$/, ''),
          active: parts[2] || 'unknown',
          sub: parts[3] || null,
        };
      });
  } catch {
    return [];
  }
}

async function readLogs(): Promise<NonNullable<AgentMetricsPayload['logs']>> {
  try {
    const { stdout } = await execFileAsync(
      'journalctl',
      ['-n', '15', '-o', 'short-iso', '--no-pager'],
      { timeout: 3000 }
    );
    return stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const m = line.match(/^(\S+)\s+\S+\s+(\S+):\s+(.*)$/);
        return {
          ts: m?.[1] ?? null,
          unit: m?.[2] ?? null,
          message: m?.[3] ?? line,
        };
      });
  } catch {
    return [];
  }
}

function readDistro(): string | null {
  const osRelease = readFileSafe('/etc/os-release');
  if (!osRelease) return null;
  const pretty = osRelease.match(/^PRETTY_NAME="?([^"\n]+)"?/m);
  return pretty?.[1] ?? null;
}

export async function collectMetrics(
  version: string
): Promise<AgentMetricsPayload> {
  const mem = parseMeminfo();
  const cpuPct = await sampleCpuUsagePct();
  const load = os.loadavg() as [number, number, number];
  const swapUsed = Math.max(0, mem.swapTotal - mem.swapFree);

  const [docker, kubernetes, services, logs] = await Promise.all([
    collectDocker(),
    collectKubernetes(),
    readServices(),
    readLogs(),
  ]);

  return {
    hostname: os.hostname(),
    version,
    collected_at: new Date().toISOString(),
    os: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      uptime_sec: Math.round(os.uptime()),
      distro: readDistro(),
    },
    cpu: {
      usage_pct: cpuPct,
      cores: os.cpus().length,
      load_avg: [
        Number(load[0].toFixed(2)),
        Number(load[1].toFixed(2)),
        Number(load[2].toFixed(2)),
      ],
    },
    memory: {
      total_bytes: mem.total || os.totalmem(),
      used_bytes: (mem.total || os.totalmem()) - (mem.available || os.freemem()),
      available_bytes: mem.available || os.freemem(),
      usage_pct: Number(
        (
          (((mem.total || os.totalmem()) - (mem.available || os.freemem())) /
            (mem.total || os.totalmem())) *
          100
        ).toFixed(2)
      ),
    },
    swap: {
      total_bytes: mem.swapTotal,
      used_bytes: swapUsed,
      usage_pct:
        mem.swapTotal > 0
          ? Number(((swapUsed / mem.swapTotal) * 100).toFixed(2))
          : 0,
    },
    disks: readDisks(),
    temperature_c: readTemperatureC(),
    network: readNetwork(),
    containers: docker.containers,
    docker,
    kubernetes,
    services,
    logs,
  };
}
