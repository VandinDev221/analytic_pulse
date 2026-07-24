import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Activity, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { getMonitor, getMonitorMetrics } from '../services/api';
import type { Monitor, MonitorMetrics, PingLog } from '../types';
import { LatencyChart } from '../components/LatencyChart';
import { ChartSkeleton } from '../components/SkeletonLoader';
import { LiveIndicator } from '../components/LiveIndicator';
import { useLiveData } from '../hooks/useLiveData';

export const MonitorDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [metrics, setMetrics] = useState<MonitorMetrics | null>(null);
  const [logs, setLogs] = useState<PingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!id) return;
    try {
      const m = await getMonitor(id);
      setMonitor(m);
      const { metrics: mtr, recent_logs } = await getMonitorMetrics(id);
      setMetrics(mtr);
      setLogs(recent_logs);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load(false);
  }, [load]);

  const { status: liveStatus } = useLiveData(() => load(true), !loading && !!id);

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
    <div className="page">
      <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ marginBottom: 20, minHeight: 44 }}>
        <ArrowLeft size={14} /> Voltar
      </button>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="skeleton" style={{ height: 100, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 260, borderRadius: 16 }} />
        </div>
      ) : monitor ? (
        <>
          {/* Monitor header card */}
          <div className="glass detail-card" style={{ padding: 28, marginBottom: 20 }}>
            <div className="detail-card__header">
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
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="detail-card__title-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, wordBreak: 'break-word' }}>{monitor.name}</h1>
                    <LiveIndicator status={liveStatus} />
                  </div>
                  <a href={monitor.url} target="_blank" rel="noopener noreferrer" className="detail-url">
                    <span style={{ minWidth: 0 }}>{monitor.url}</span> <ExternalLink size={11} style={{ flexShrink: 0 }} />
                  </a>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Tipo: <strong style={{ color: 'var(--text-secondary)' }}>{(monitor.check_type || 'http').toUpperCase()}</strong>
                    {monitor.method && (monitor.check_type === 'http' || monitor.check_type === 'https' || !monitor.check_type)
                      ? ` · ${monitor.method}`
                      : null}
                  </div>
                  {lastUpdated && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                      Atualizado {lastUpdated.toLocaleTimeString('pt-BR')}
                    </span>
                  )}
                </div>
              </div>
              <span className={`badge ${isUp ? 'badge-up' : monitor.status === 'down' ? 'badge-down' : 'badge-unknown'}`} style={{ fontSize: 13, padding: '5px 14px' }}>
                <span className={`pulse-dot ${isUp ? 'pulse-dot-green' : 'pulse-dot-red'}`} />
                {isUp ? 'Online' : monitor.status === 'down' ? 'Offline' : 'Aguardando'}
              </span>
            </div>

            {/* Metrics row */}
            <div className="metrics-grid">
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

          {monitor.check_type === 'dns' && (
            <div className="glass detail-card" style={{ padding: 28, marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                Resolução DNS
              </h2>
              <div className="metrics-grid">
                {[
                  {
                    label: 'Tipo',
                    value: (monitor.dns_record_type || 'A').toUpperCase(),
                    color: 'var(--accent-light)',
                  },
                  {
                    label: 'Registros',
                    value:
                      monitor.dns_record_count != null
                        ? String(monitor.dns_record_count)
                        : '—',
                    color: 'var(--text-primary)',
                  },
                  {
                    label: 'Última resolução',
                    value: monitor.dns_resolved_at
                      ? new Date(monitor.dns_resolved_at).toLocaleString('pt-BR')
                      : '—',
                    color: 'var(--text-secondary)',
                  },
                  {
                    label: 'Latência DNS',
                    value: monitor.last_response_time_ms
                      ? `${monitor.last_response_time_ms} ms`
                      : '—',
                    color: 'var(--green)',
                  },
                ].map((m) => (
                  <div
                    key={m.label}
                    style={{
                      background: 'var(--bg-base)',
                      borderRadius: 10,
                      padding: '14px 16px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ fontSize: 18, fontWeight: 700, color: m.color, marginBottom: 3 }}>
                      {m.value}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.label}</div>
                  </div>
                ))}
              </div>
              {monitor.dns_answers_preview && (
                <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <strong>Respostas:</strong> {monitor.dns_answers_preview}
                </div>
              )}
              {Array.isArray(monitor.dns_last_records) && monitor.dns_last_records.length > 0 && (
                <ul style={{ marginTop: 12, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)' }}>
                  {(monitor.dns_last_records as Array<{ value?: string; priority?: number }>).slice(0, 10).map((r, i) => (
                    <li key={i} style={{ marginBottom: 4, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {r.priority != null ? `${r.priority} ` : ''}
                      {r.value || JSON.stringify(r)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {monitor.check_type === 'ssl' && (
            <div className="glass detail-card" style={{ padding: 28, marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                Certificado SSL / TLS
              </h2>
              <div className="metrics-grid">
                {[
                  {
                    label: 'Dias restantes',
                    value:
                      monitor.ssl_days_remaining != null
                        ? String(monitor.ssl_days_remaining)
                        : '—',
                    color:
                      monitor.ssl_days_remaining == null
                        ? 'var(--text-muted)'
                        : monitor.ssl_days_remaining < 0
                          ? 'var(--red)'
                          : monitor.ssl_days_remaining <= 7
                            ? 'var(--red)'
                            : monitor.ssl_days_remaining <= (monitor.ssl_warn_days ?? 30)
                              ? 'var(--yellow)'
                              : 'var(--green)',
                  },
                  {
                    label: 'Válido até',
                    value: monitor.ssl_valid_to
                      ? new Date(monitor.ssl_valid_to).toLocaleDateString('pt-BR')
                      : '—',
                    color: 'var(--text-primary)',
                  },
                  {
                    label: 'Protocolo',
                    value: monitor.ssl_protocol || '—',
                    color: 'var(--accent-light)',
                  },
                  {
                    label: 'Cipher',
                    value: monitor.ssl_cipher || '—',
                    color: 'var(--text-secondary)',
                  },
                ].map((m) => (
                  <div
                    key={m.label}
                    style={{
                      background: 'var(--bg-base)',
                      borderRadius: 10,
                      padding: '14px 16px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ fontSize: 18, fontWeight: 700, color: m.color, marginBottom: 3 }}>
                      {m.value}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <div><strong>Issuer:</strong> {monitor.ssl_issuer || '—'}</div>
                <div style={{ marginTop: 6 }}><strong>Subject:</strong> {monitor.ssl_subject || '—'}</div>
                {monitor.ssl_fingerprint && (
                  <div style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    <strong>Fingerprint:</strong> {monitor.ssl_fingerprint}
                  </div>
                )}
                <div style={{ marginTop: 6, color: 'var(--text-muted)' }}>
                  Aviso automático em ≤ {monitor.ssl_warn_days ?? 30} dias
                </div>
              </div>
            </div>
          )}

          {/* Timing breakdown do último check */}
          {logs[0] && (
            <div className="glass detail-card" style={{ padding: 28, marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
                Último check — timings
              </h2>
              <div className="metrics-grid metrics-grid--timings">
                {[
                  { label: 'DNS', value: logs[0].dns_ms },
                  { label: 'TCP', value: logs[0].tcp_ms },
                  { label: 'TLS', value: logs[0].tls_ms },
                  { label: 'TTFB', value: logs[0].ttfb_ms },
                  { label: 'Download', value: logs[0].download_ms },
                  { label: 'Total', value: logs[0].response_time_ms },
                ].map((t) => (
                  <div
                    key={t.label}
                    style={{
                      background: 'var(--bg-base)',
                      borderRadius: 10,
                      padding: '14px 16px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 3 }}>
                      {t.value != null ? `${t.value} ms` : '—'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.label}</div>
                  </div>
                ))}
              </div>
              {(logs[0].response_size_bytes != null ||
                (logs[0].redirect_chain && logs[0].redirect_chain.length > 1)) && (
                <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
                  {logs[0].response_size_bytes != null && (
                    <div>Response size: {logs[0].response_size_bytes} bytes</div>
                  )}
                  {logs[0].redirect_chain && logs[0].redirect_chain.length > 1 && (
                    <div style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      Redirects: {logs[0].redirect_chain.join(' → ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Latency chart card */}
          <div className="glass detail-card" style={{ padding: 28, marginBottom: 20 }}>
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
                  <div key={log.id} className="incident-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span style={{ color: 'var(--red)', fontSize: 12, flexShrink: 0 }}>⚠</span>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-word' }}>
                        {log.error_message ?? `HTTP ${log.status_code}`}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};
