import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Activity, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { getMonitor, getMonitorMetrics } from '../services/api';
import type { MonitorMetrics, PingLog } from '../types';
import { LatencyChart } from '../components/LatencyChart';
import { ChartSkeleton } from '../components/SkeletonLoader';

export const MonitorDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [monitor, setMonitor] = useState<any>(null);
  const [metrics, setMetrics] = useState<MonitorMetrics | null>(null);
  const [logs, setLogs] = useState<PingLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        // Load monitor details from backend API
        const m = await getMonitor(id!);
        setMonitor(m);

        // Load metrics + logs from backend API
        const { metrics: mtr, recent_logs } = await getMonitorMetrics(id!);
        setMetrics(mtr);
        setLogs(recent_logs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  if (!monitor && !loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 80, gap: 16 }}>
        <h2 style={{ color: 'var(--text-secondary)' }}>Monitor não encontrado</h2>
        <button className="btn btn-ghost" onClick={() => navigate('/')}>← Voltar</button>
      </div>
    );
  }

  const uptime = metrics?.uptime_pct_7d;
  const avgLatency = metrics?.avg_response_time_7d;
  const isUp = monitor?.status === 'up';

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Back button */}
      <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ marginBottom: 24, padding: '8px 14px' }}>
        <ArrowLeft size={14} /> Voltar
      </button>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="skeleton" style={{ height: 100, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 260, borderRadius: 16 }} />
        </div>
      ) : (
        <>
          {/* Monitor header card */}
          <div className="glass" style={{ padding: 28, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: isUp
                    ? 'linear-gradient(135deg,rgba(34,197,94,0.2),rgba(34,197,94,0.05))'
                    : 'linear-gradient(135deg,rgba(239,68,68,0.2),rgba(239,68,68,0.05))',
                  border: `1px solid ${isUp ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Activity size={22} color={isUp ? 'var(--green)' : 'var(--red)'} />
                </div>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{monitor.name}</h1>
                  <a href={monitor.url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {monitor.url} <ExternalLink size={11} />
                  </a>
                </div>
              </div>
              <span className={`badge ${isUp ? 'badge-up' : monitor.status === 'down' ? 'badge-down' : 'badge-unknown'}`} style={{ fontSize: 13, padding: '5px 14px' }}>
                <span className={`pulse-dot ${isUp ? 'pulse-dot-green' : 'pulse-dot-red'}`} />
                {isUp ? 'Online' : monitor.status === 'down' ? 'Offline' : 'Aguardando'}
              </span>
            </div>

            {/* Metrics row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
              {[
                {
                  label: 'Uptime 7 dias',
                  value: uptime !== null && uptime !== undefined ? `${Number(uptime).toFixed(2)}%` : '—',
                  icon: <CheckCircle size={15} />,
                  color: uptime !== null && uptime !== undefined ? (uptime >= 99 ? 'var(--green)' : uptime >= 90 ? 'var(--yellow)' : 'var(--red)') : 'var(--text-muted)',
                },
                {
                  label: 'Latência média',
                  value: avgLatency ? `${Math.round(avgLatency)} ms` : '—',
                  icon: <Clock size={15} />,
                  color: avgLatency ? (avgLatency < 300 ? 'var(--green)' : avgLatency < 1000 ? 'var(--yellow)' : 'var(--red)') : 'var(--text-muted)',
                },
                {
                  label: 'Última resposta',
                  value: monitor.last_response_time_ms ? `${monitor.last_response_time_ms} ms` : '—',
                  icon: <Activity size={15} />,
                  color: 'var(--accent-light)',
                },
                {
                  label: 'Verificações 7d',
                  value: metrics?.total_checks_7d ?? '—',
                  icon: <AlertTriangle size={15} />,
                  color: 'var(--text-secondary)',
                },
              ].map(m => (
                <div key={m.label} style={{
                  background: 'var(--bg-base)', borderRadius: 10, padding: '14px 16px',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: m.color, marginBottom: 8 }}>{m.icon}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: m.color, marginBottom: 3 }}>{m.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Latency chart card */}
          <div className="glass" style={{ padding: 28, marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: 'var(--text-primary)' }}>
              Latência — últimas verificações
            </h2>
            {loading ? <ChartSkeleton /> : <LatencyChart logs={logs} />}
          </div>

          {/* Recent incidents */}
          {logs.filter(l => !l.is_up).length > 0 && (
            <div className="glass" style={{ padding: 28 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
                Incidentes recentes
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {logs.filter(l => !l.is_up).slice(0, 10).map(log => (
                  <div key={log.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', background: 'rgba(239,68,68,0.06)',
                    border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: 'var(--red)', fontSize: 12 }}>⚠</span>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {log.error_message ?? `HTTP ${log.status_code}`}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
