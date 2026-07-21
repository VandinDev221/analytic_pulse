import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  RefreshCw,
  Activity,
  CheckCircle,
  AlertTriangle,
  Link2,
  Radio,
  Gauge,
  Timer,
  ShieldCheck,
} from 'lucide-react';
import { getMonitors, getMe, getDashboardOverview } from '../services/api';
import type { Monitor, DashboardOverview } from '../types';
import { MonitorCard } from '../components/MonitorCard';
import { MonitorModal } from '../components/MonitorModal';
import { DashboardSkeleton } from '../components/SkeletonLoader';
import { SmartStatCard } from '../components/dashboard/SmartStatCard';
import { DashboardHeatmap } from '../components/dashboard/DashboardHeatmap';
import { UsageChart } from '../components/dashboard/UsageChart';
import { EventTimeline } from '../components/dashboard/EventTimeline';
import { TopIncidents, TopLatencies } from '../components/dashboard/TopLists';
import { usePolling, POLL_INTERVAL_MS } from '../hooks/usePolling';

function formatMs(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export const DashboardPage: React.FC = () => {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState<Monitor | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [userSlug, setUserSlug] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [mons, ov] = await Promise.all([
        getMonitors(),
        getDashboardOverview(),
      ]);
      setMonitors(mons);
      setOverview(ov);
      setLastUpdated(new Date());
      setError('');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Falha ao carregar dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    getMe()
      .then((u) => {
        if (u?.slug) setUserSlug(u.slug);
      })
      .catch(console.error);
  }, [load]);

  usePolling(() => load(true), POLL_INTERVAL_MS, !loading);

  const s = overview?.summary;
  const allUp = s != null && s.monitors_down === 0 && s.monitors_total > 0;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-header__title-row">
            <h1>Dashboard</h1>
            {!loading && (
              <span className="live-badge">
                <Radio size={10} style={{ animation: 'pulse 2s ease-in-out infinite' }} />
                Ao vivo
              </span>
            )}
          </div>
          <p className="page-header__desc">
            Visão operacional: disponibilidade, performance e incidentes.
            {lastUpdated && (
              <span className="page-header__updated">
                Atualizado {lastUpdated.toLocaleTimeString('pt-BR')}
              </span>
            )}
          </p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn-ghost" onClick={() => load()} disabled={refreshing}>
            <RefreshCw
              size={14}
              style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}
            />
            Atualizar
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={15} /> Novo
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-sm" style={{ padding: 12, marginBottom: 16, color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {s && s.monitors_total > 0 && (
            <section className="dash-kpi-grid">
              <SmartStatCard
                label="Disponibilidade 90d"
                value={s.overall_uptime_90d != null ? `${s.overall_uptime_90d.toFixed(2)}%` : '—'}
                hint={`Meta SLA ${s.sla_target_pct}%`}
                tone={
                  s.sla_met === true ? 'good' : s.sla_met === false ? 'bad' : 'default'
                }
                trend={s.uptime_trend}
                icon={<ShieldCheck size={15} />}
              />
              <SmartStatCard
                label="Latência média 7d"
                value={s.avg_latency_7d != null ? `${s.avg_latency_7d} ms` : '—'}
                hint={
                  s.avg_latency_prev_7d != null
                    ? `Antes ${s.avg_latency_prev_7d} ms`
                    : 'vs semana anterior'
                }
                trend={s.latency_trend}
                invertTrend
                icon={<Gauge size={15} />}
              />
              <SmartStatCard
                label="MTTR"
                value={formatMs(s.mttr_ms)}
                hint="Tempo médio de recuperação"
                icon={<Timer size={15} />}
              />
              <SmartStatCard
                label="Incidentes abertos"
                value={String(s.open_incidents)}
                hint={`${s.monitors_down} monitores offline`}
                tone={s.open_incidents > 0 ? 'bad' : 'good'}
                icon={<AlertTriangle size={15} />}
              />
              <SmartStatCard
                label="Checks"
                value={s.checks_24h.toLocaleString('pt-BR')}
                hint={`${s.checks_7d.toLocaleString('pt-BR')} / 7d · ${s.checks_30d.toLocaleString('pt-BR')} / 30d`}
                icon={<Activity size={15} />}
              />
              <SmartStatCard
                label="Estado"
                value={allUp ? 'Operacional' : `${s.monitors_down} com falha`}
                hint={`${s.monitors_up}/${s.monitors_total} online`}
                tone={allUp ? 'good' : 'bad'}
                icon={
                  allUp ? (
                    <CheckCircle size={15} />
                  ) : (
                    <AlertTriangle size={15} />
                  )
                }
              />
            </section>
          )}

          {userSlug && (
            <div className="glass-sm public-link-bar">
              <Link2 size={14} color="var(--accent-light)" style={{ flexShrink: 0 }} />
              <span style={{ color: 'var(--text-secondary)' }}>Página pública:</span>
              <a href={`/status/${userSlug}`} target="_blank" rel="noopener noreferrer">
                /status/{userSlug}
              </a>
            </div>
          )}

          {overview && s && s.monitors_total > 0 && (
            <>
              <div className="dash-grid-2">
                <section className="glass dash-panel">
                  <div className="dash-panel__head">
                    <h2>Heatmap de uptime</h2>
                    <p>Últimos 90 dias por monitor</p>
                  </div>
                  <DashboardHeatmap rows={overview.heatmap} />
                </section>

                <section className="glass dash-panel">
                  <div className="dash-panel__head">
                    <h2>Uso de checks</h2>
                    <p>Volume diário, semanal e mensal</p>
                  </div>
                  <UsageChart usage={overview.usage} />
                </section>
              </div>

              <div className="dash-grid-3">
                <section className="glass dash-panel">
                  <div className="dash-panel__head">
                    <h2>Top latências</h2>
                    <p>Média dos últimos 7 dias</p>
                  </div>
                  <TopLatencies items={overview.top_latencies} />
                </section>

                <section className="glass dash-panel">
                  <div className="dash-panel__head">
                    <h2>Top incidentes</h2>
                    <p>Abertos e recentes</p>
                  </div>
                  <TopIncidents items={overview.top_incidents} />
                </section>

                <section className="glass dash-panel">
                  <div className="dash-panel__head">
                    <h2>Timeline</h2>
                    <p>Eventos dos últimos 14 dias</p>
                  </div>
                  <EventTimeline items={overview.timeline} />
                </section>
              </div>
            </>
          )}

          <section className="dash-monitors">
            <div className="dash-panel__head dash-monitors__head">
              <div>
                <h2>Monitores</h2>
                <p>Gerencie e acompanhe seus serviços</p>
              </div>
              <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                <Plus size={15} /> Novo
              </button>
            </div>

            {monitors.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '60px 20px',
                  gap: 16,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 20,
                    background:
                      'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.1))',
                    border: '1px solid rgba(99,102,241,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Activity size={32} color="#6366f1" />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                    Nenhum monitor ainda
                  </h3>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 320 }}>
                    Adicione seu primeiro site ou API para começar a monitorar a disponibilidade.
                  </p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowModal(true)}
                  style={{ minHeight: 48 }}
                >
                  <Plus size={15} /> Criar primeiro monitor
                </button>
              </div>
            ) : (
              <div className="monitor-list">
                {monitors.map((m, i) => (
                  <div key={m.id} style={{ animationDelay: `${i * 60}ms` }}>
                    <MonitorCard
                      monitor={m}
                      onDeleted={(id) => setMonitors((prev) => prev.filter((x) => x.id !== id))}
                      onUpdated={(updated) =>
                        setMonitors((prev) =>
                          prev.map((x) => (x.id === updated.id ? updated : x))
                        )
                      }
                      onEdit={setEditingMonitor}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {showModal && (
        <MonitorModal
          onClose={() => setShowModal(false)}
          onSaved={(monitor) => {
            setMonitors((prev) => [monitor, ...prev]);
            load(true);
          }}
        />
      )}

      {editingMonitor && (
        <MonitorModal
          monitor={editingMonitor}
          onClose={() => setEditingMonitor(null)}
          onSaved={(updated) => {
            setMonitors((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
            setEditingMonitor(null);
            load(true);
          }}
        />
      )}
    </div>
  );
};
