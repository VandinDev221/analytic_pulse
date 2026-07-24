import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Clock,
  Gauge,
  RefreshCw,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import { getAnalyticsOverview } from '../services/api';
import type { AnalyticsOverview, AnalyticsRange } from '../types';
import {
  AvailabilityChart,
  LatencyPercentileChart,
} from '../components/analytics/AnalyticsCharts';
import { SmartStatCard } from '../components/dashboard/SmartStatCard';
import { usePolling, POLL_INTERVAL_MS } from '../hooks/usePolling';

const RANGES: Array<{ value: AnalyticsRange; label: string }> = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
];

function formatMs(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d`;
}

export const AnalyticsPage: React.FC = () => {
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (r: AnalyticsRange, silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const overview = await getAnalyticsOverview(r);
      setData(overview);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load(range);
  }, [range, load]);

  usePolling(() => load(range, true), POLL_INTERVAL_MS, !loading);

  const s = data?.summary;

  return (
    <div className="page page--wide">
      <div className="page-header">
        <div>
          <div className="page-header__title-row">
            <h1>Analytics</h1>
          </div>
          <p className="page-header__desc">
            Latência (média, P50, P95, P99), disponibilidade, MTTR e MTBF.
          </p>
        </div>
        <div className="page-header__actions">
          <div className="dash-tabs" style={{ marginBottom: 0 }}>
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                className={`dash-tab ${range === r.value ? 'is-active' : ''}`}
                onClick={() => setRange(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            className="btn btn-ghost"
            onClick={() => load(range)}
            disabled={refreshing}
          >
            <RefreshCw
              size={14}
              style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}
            />
            Atualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-sm" style={{ padding: 12, marginBottom: 16, color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {loading || !data || !s ? (
        <div className="glass world-map-skeleton" />
      ) : (
        <>
          <section className="dash-kpi-grid analytics-kpi">
            <SmartStatCard
              label="Disponibilidade"
              value={s.availability_pct != null ? `${s.availability_pct.toFixed(3)}%` : '—'}
              hint={`${s.checks_up.toLocaleString('pt-BR')} / ${s.checks_total.toLocaleString('pt-BR')} checks`}
              tone={
                s.availability_pct != null && s.availability_pct >= 99.9
                  ? 'good'
                  : s.availability_pct != null && s.availability_pct < 99
                    ? 'bad'
                    : 'default'
              }
              icon={<ShieldCheck size={15} />}
            />
            <SmartStatCard
              label="Latência média"
              value={s.latency.avg_ms != null ? `${s.latency.avg_ms} ms` : '—'}
              hint={`P50 ${s.latency.p50_ms ?? '—'} · n=${s.latency.samples}`}
              icon={<Gauge size={15} />}
            />
            <SmartStatCard
              label="P95"
              value={s.latency.p95_ms != null ? `${s.latency.p95_ms} ms` : '—'}
              hint="95º percentil"
              icon={<BarChart3 size={15} />}
            />
            <SmartStatCard
              label="P99"
              value={s.latency.p99_ms != null ? `${s.latency.p99_ms} ms` : '—'}
              hint="99º percentil"
              icon={<Activity size={15} />}
            />
            <SmartStatCard
              label="MTTR"
              value={formatMs(s.mttr_ms)}
              hint="Tempo médio de recuperação"
              icon={<Timer size={15} />}
            />
            <SmartStatCard
              label="MTBF"
              value={formatMs(s.mtbf_ms)}
              hint={`${s.incidents_total} incidentes · ${s.incidents_open} abertos`}
              icon={<Clock size={15} />}
            />
          </section>

          <div className="dash-grid-2">
            <section className="glass dash-panel">
              <div className="dash-panel__head">
                <h2>Latência por percentil</h2>
                <p>Média, P50, P95 e P99 no período</p>
              </div>
              <LatencyPercentileChart series={data.latency_series} />
            </section>
            <section className="glass dash-panel">
              <div className="dash-panel__head">
                <h2>Disponibilidade</h2>
                <p>Uptime diário agregado</p>
              </div>
              <AvailabilityChart series={data.availability_series} />
            </section>
          </div>

          <section className="glass dash-panel">
            <div className="dash-panel__head">
              <h2>Por monitor</h2>
              <p>Comparativo de disponibilidade e latência</p>
            </div>
            {data.monitors.length === 0 ? (
              <div className="dash-empty">Nenhum monitor ativo.</div>
            ) : (
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Monitor</th>
                      <th>Status</th>
                      <th>Disponibilidade</th>
                      <th>Média</th>
                      <th>P50</th>
                      <th>P95</th>
                      <th>P99</th>
                      <th>Checks</th>
                      <th>Incidentes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monitors.map((m) => (
                      <tr key={m.monitor_id}>
                        <td>
                          <Link to={`/monitors/${m.monitor_id}`}>{m.name}</Link>
                        </td>
                        <td>
                          <span className={`badge badge-${m.status}`}>{m.status}</span>
                        </td>
                        <td>
                          {m.availability_pct != null
                            ? `${m.availability_pct.toFixed(2)}%`
                            : '—'}
                        </td>
                        <td>{m.latency.avg_ms != null ? `${m.latency.avg_ms}` : '—'}</td>
                        <td>{m.latency.p50_ms != null ? `${m.latency.p50_ms}` : '—'}</td>
                        <td>{m.latency.p95_ms != null ? `${m.latency.p95_ms}` : '—'}</td>
                        <td>{m.latency.p99_ms != null ? `${m.latency.p99_ms}` : '—'}</td>
                        <td>{m.checks_total.toLocaleString('pt-BR')}</td>
                        <td>{m.incidents}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
