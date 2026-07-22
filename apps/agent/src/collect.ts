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

async function readContainers(): Promise<NonNullable<AgentMetricsPayload['containers']>> {
  try {
    const { stdout } = await execFileAsync(
      'docker',
      ['ps', '--format', '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}'],
      { timeout: 3000 }
    );
    return stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [id, name, image, ...statusParts] = line.split('\t');
        return {
          id: id || '',
          name: name || '',
          image: image || '',
          status: statusParts.join('\t') || '',
        };
      });
  } catch {
    return [];
  }
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

  const [containers, services, logs] = await Promise.all([
    readContainers(),
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
    containers,
    services,
    logs,
  };
}
