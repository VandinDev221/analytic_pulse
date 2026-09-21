import React, { useEffect, useState } from 'react';
import { ShieldCheck, Database, Server, RefreshCw, Activity, HardDrive, Cpu, Clock, Layers, Zap } from 'lucide-react';
import { getApiHealth } from '../services/api';

interface HealthData {
  status: string;
  timestamp?: string;
  latency_ms?: number;
  error?: string;
  api?: {
    uptime_seconds: number;
    memory: {
      rss_mb: number;
      heap_used_mb: number;
      heap_total_mb: number;
    };
    node_version: string;
  };
  postgres?: {
    connected: boolean;
    schema_ready: boolean;
    error?: string;
    metrics?: {
      size: { bytes: number; pretty: string };
      tables: number;
      connections: {
        active: number;
        idle: number;
        total: number;
        pool_total: number;
        pool_idle: number;
        pool_waiting: number;
      };
      top_tables: Array<{ name: string; rows: number }>;
    } | null;
  };
  redis?: {
    connected: boolean;
    error?: string;
    metrics?: {
      memory: {
        used_mb: number;
        max_mb: number | null;
        usage_pct: number | null;
      };
      clients: { connected: number; blocked: number };
      stats: {
        total_commands: number;
        ops_per_sec: number;
        hit_rate: number | null;
        total_keys: number;
      };
      server: {
        version: string | null;
        uptime_seconds: number;
        uptime_days: number;
      };
    } | null;
  };
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function StatusBadge({ ok, labelOk, labelFail }: { ok: boolean; labelOk: string; labelFail: string }) {
  const cls = ok
    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  return <span className={'px-2 py-1 text-xs font-medium rounded-full ' + cls}>{ok ? labelOk : labelFail}</span>;
}

function MetricRow({ label, value, unit }: { label: string; value: string | number | null | undefined; unit?: string }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-900 dark:text-white">
        {value}{unit ? ' ' + unit : ''}
      </span>
    </div>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
      <div className={'h-2 rounded-full ' + color} style={{ width: pct + '%' }} />
    </div>
  );
}

export function ApiStatusPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const data = await getApiHealth();
      setHealth(data);
    } catch (err) {
      setHealth({ status: 'offline', error: String(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !health) {
    return <div className="p-8 text-center text-gray-500">Verificando status da API...</div>;
  }

  const isOk = health?.status === 'ok';
  const pg = health?.postgres;
  const rd = health?.redis;
  const api = health?.api;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Status da Infraestrutura</h1>
          <p className="text-sm text-gray-500">Monitoramento em tempo real — atualiza a cada 30s</p>
        </div>
        <button
          onClick={fetchHealth}
          className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition"
        >
          <RefreshCw className={'w-5 h-5 text-gray-600 dark:text-gray-300' + (loading ? ' animate-spin' : '')} />
        </button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-500" /> API Server
            </h3>
            <StatusBadge ok={isOk} labelOk="Online" labelFail="Degraded" />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {health?.timestamp ? new Date(health.timestamp).toLocaleString() : 'N/A'}
          </p>
          {health?.latency_ms !== undefined && (
            <p className="text-xs text-gray-400 mt-1">Latência: {health.latency_ms}ms</p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-purple-500" /> PostgreSQL
            </h3>
            <StatusBadge ok={pg?.connected ?? false} labelOk="Connected" labelFail="Disconnected" />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {pg?.connected && pg?.schema_ready ? 'Schema OK' : pg?.error || 'Schema pendente'}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-red-500" /> Redis Cloud
            </h3>
            <StatusBadge ok={rd?.connected ?? false} labelOk="Connected" labelFail="Disconnected" />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {rd?.connected ? 'Cache ativo' : rd?.error || 'Cache inativo'}
          </p>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* API Metrics */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4 pb-2 border-b border-gray-100 dark:border-gray-700">
            <Cpu className="w-4 h-4 text-blue-500" /> API — Consumo
          </h3>
          {api ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              <MetricRow label="Uptime" value={formatUptime(api.uptime_seconds)} />
              <MetricRow label="Node.js" value={api.node_version} />
              <MetricRow label="RSS Memory" value={api.memory.rss_mb} unit="MB" />
              <div className="py-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Heap</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {api.memory.heap_used_mb} / {api.memory.heap_total_mb} MB
                  </span>
                </div>
                <ProgressBar value={api.memory.heap_used_mb} max={api.memory.heap_total_mb} color="bg-blue-500" />
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Sem dados</p>
          )}
        </div>

        {/* PostgreSQL Metrics */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4 pb-2 border-b border-gray-100 dark:border-gray-700">
            <HardDrive className="w-4 h-4 text-purple-500" /> PostgreSQL — Consumo
          </h3>
          {pg?.metrics ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              <MetricRow label="Tamanho do DB" value={pg.metrics.size.pretty} />
              <MetricRow label="Tabelas" value={pg.metrics.tables} />
              <MetricRow label="Conexões ativas" value={pg.metrics.connections.active} />
              <MetricRow label="Conexões idle" value={pg.metrics.connections.idle} />
              <MetricRow label="Pool (usado/total)" value={pg.metrics.connections.pool_total - pg.metrics.connections.pool_idle + ' / ' + pg.metrics.connections.pool_total} />
              {pg.metrics.top_tables.length > 0 && (
                <div className="py-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Top Tabelas</span>
                  {pg.metrics.top_tables.slice(0, 5).map((t) => (
                    <div key={t.name} className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-600 dark:text-gray-300 font-mono">{t.name}</span>
                      <span className="text-xs text-gray-500">{formatNumber(t.rows)} rows</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400">{pg?.connected ? 'Carregando...' : 'Indisponível'}</p>
          )}
        </div>

        {/* Redis Metrics */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4 pb-2 border-b border-gray-100 dark:border-gray-700">
            <Zap className="w-4 h-4 text-red-500" /> Redis — Consumo
          </h3>
          {rd?.metrics ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              <div className="py-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Memória</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {rd.metrics.memory.used_mb} MB
                    {rd.metrics.memory.max_mb ? ' / ' + rd.metrics.memory.max_mb + ' MB' : ''}
                  </span>
                </div>
                {rd.metrics.memory.max_mb && (
                  <ProgressBar value={rd.metrics.memory.used_mb} max={rd.metrics.memory.max_mb} color="bg-red-500" />
                )}
              </div>
              <MetricRow label="Chaves" value={rd.metrics.stats.total_keys} />
              <MetricRow label="Ops/seg" value={rd.metrics.stats.ops_per_sec} />
              <MetricRow label="Comandos totais" value={formatNumber(rd.metrics.stats.total_commands)} />
              <MetricRow label="Hit Rate" value={rd.metrics.stats.hit_rate !== null ? rd.metrics.stats.hit_rate + '%' : 'N/A'} />
              <MetricRow label="Clientes conectados" value={rd.metrics.clients.connected} />
              <MetricRow label="Versão" value={rd.metrics.server.version} />
              <MetricRow label="Uptime" value={formatUptime(rd.metrics.server.uptime_seconds)} />
            </div>
          ) : (
            <p className="text-xs text-gray-400">{rd?.connected ? 'Carregando...' : 'Indisponível'}</p>
          )}
        </div>
      </div>
    </div>
  );
}
