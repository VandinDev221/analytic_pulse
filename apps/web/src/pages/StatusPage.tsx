import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Activity,
  Calendar,
  CheckCircle,
  ExternalLink,
  Mail,
  Moon,
  Radio,
  Rss,
  Sun,
  XCircle,
} from 'lucide-react';
import { getStatusPage, subscribeStatusPage } from '../services/api';
import type { StatusPageData } from '../types';
import { UptimeGrid } from '../components/UptimeGrid';
import { GridSkeleton } from '../components/SkeletonLoader';
import { usePolling, POLL_INTERVAL_MS } from '../hooks/usePolling';

type ThemeMode = 'light' | 'dark';

function resolveTheme(
  preferred: 'system' | 'light' | 'dark' | undefined,
  override: ThemeMode | null
): ThemeMode {
  if (override) return override;
  if (preferred === 'light' || preferred === 'dark') return preferred;
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

function formatDuration(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export const StatusPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<StatusPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [themeOverride, setThemeOverride] = useState<ThemeMode | null>(null);
  const [email, setEmail] = useState('');
  const [subscribeMsg, setSubscribeMsg] = useState('');
  const [subscribing, setSubscribing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!slug) return;
    try {
      const page = await getStatusPage(slug);
      setData(page);
      setError('');
      setLastUpdated(new Date());
    } catch {
      if (!silent) setError('Página de status não encontrada.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    setLoading(true);
    load(false);
  }, [load]);

  usePolling(() => load(true), POLL_INTERVAL_MS, !loading && !!slug && !error);

  const theme = useMemo(
    () => resolveTheme(data?.profile.theme, themeOverride),
    [data?.profile.theme, themeOverride]
  );

  const accent = data?.profile.accent_color || '#6366f1';
  const allOperational = data?.monitors.every((m) => m.status !== 'down') ?? false;
  const apiBase =
    import.meta.env.VITE_API_URL?.replace(/\/$/, '') ||
    'https://analytic-pulse-api.onrender.com';

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!slug || !email.trim()) return;
    setSubscribing(true);
    setSubscribeMsg('');
    try {
      const res = await subscribeStatusPage(slug, email.trim());
      setSubscribeMsg(res.message);
      setEmail('');
    } catch (err) {
      setSubscribeMsg(err instanceof Error ? err.message : 'Falha na inscrição');
    } finally {
      setSubscribing(false);
    }
  }

  const bg = theme === 'light' ? '#f8fafc' : '#0b0f19';
  const cardBg = theme === 'light' ? '#ffffff' : 'rgba(255,255,255,0.03)';
  const text = theme === 'light' ? '#0f172a' : '#e2e8f0';
  const muted = theme === 'light' ? '#64748b' : '#94a3b8';
  const border = theme === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)';

  return (
    <div style={{ minHeight: '100vh', background: bg, color: text, position: 'relative' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setThemeOverride(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Alternar tema"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          {slug && (
            <a className="btn btn-ghost" href={`${apiBase}/api/status/${slug}/rss.xml`} target="_blank" rel="noreferrer">
              <Rss size={14} /> RSS
            </a>
          )}
        </div>

        {loading ? (
          <StatusPageSkeleton />
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: muted }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Página não encontrada</h1>
            <p>{error}</p>
          </div>
        ) : data ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
                {data.profile.logo_url ? (
                  <img src={data.profile.logo_url} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: `linear-gradient(135deg,${accent},#8b5cf6)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Activity size={18} color="#fff" />
                  </div>
                )}
                <span style={{ fontSize: 18, fontWeight: 700 }}>
                  {data.profile.display_name || 'Status'}
                </span>
              </div>

              <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
                {data.profile.page_title || `${data.profile.display_name} Status`}
              </h1>
              {data.profile.page_description && (
                <p style={{ fontSize: 15, color: muted, maxWidth: 480, margin: '0 auto' }}>
                  {data.profile.page_description}
                </p>
              )}

              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 10, marginTop: 22,
                padding: '12px 24px', borderRadius: 99,
                background: allOperational ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                border: `1px solid ${allOperational ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>
                <span className={`pulse-dot ${allOperational ? 'pulse-dot-green' : 'pulse-dot-red'}`} />
                <span style={{ fontSize: 15, fontWeight: 600, color: allOperational ? '#16a34a' : '#dc2626' }}>
                  {allOperational ? 'Todos os sistemas operacionais' : 'Degradação detectada'}
                </span>
              </div>

              {lastUpdated && (
                <p style={{ fontSize: 12, color: muted, marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Radio size={10} color="#16a34a" />
                  Atualização automática · {lastUpdated.toLocaleTimeString('pt-BR')}
                </p>
              )}
            </div>

            {/* SLA / stats */}
            {data.stats && (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 28,
              }}>
                {[
                  { label: 'Uptime 90d', value: data.stats.overall_uptime_90d != null ? `${data.stats.overall_uptime_90d}%` : '—' },
                  { label: `SLA ${data.stats.sla_target_pct}%`, value: data.stats.sla_met == null ? '—' : data.stats.sla_met ? 'OK' : 'Abaixo' },
                  { label: 'Latência média 7d', value: data.stats.avg_latency_7d != null ? `${data.stats.avg_latency_7d} ms` : '—' },
                  { label: 'MTTR', value: data.stats.mttr_ms != null ? formatDuration(data.stats.mttr_ms) : '—' },
                ].map((s) => (
                  <div key={s.label} style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 14, padding: 16 }}>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: muted }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Maintenance */}
            {data.profile.show_maintenance !== false && (data.maintenance?.length ?? 0) > 0 && (
              <section style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 16, fontWeight: 650, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={16} /> Manutenção
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.maintenance!.map((m) => (
                    <div key={m.id} style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
                      <div style={{ fontWeight: 600 }}>{m.title}</div>
                      <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>
                        {new Date(m.starts_at).toLocaleString('pt-BR')} → {new Date(m.ends_at).toLocaleString('pt-BR')}
                      </div>
                      {m.description && <p style={{ fontSize: 13, marginTop: 8, color: muted }}>{m.description}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Monitors */}
            {data.monitors.length === 0 ? (
              <p style={{ textAlign: 'center', color: muted }}>Nenhum monitor configurado.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                {data.monitors.map((monitor, idx) => {
                  const days = data.uptime_grids[monitor.id] ?? [];
                  const isUp = monitor.status !== 'down';
                  const uptime = monitor.uptime_90d ? Number(monitor.uptime_90d) : null;

                  return (
                    <div key={monitor.id} className="animate-fade-in-up" style={{ animationDelay: `${idx * 60}ms` }}>
                      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 14, padding: '20px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {isUp ? <CheckCircle size={16} color="#16a34a" /> : <XCircle size={16} color="#dc2626" />}
                            <span style={{ fontWeight: 600, fontSize: 15 }}>{monitor.name}</span>
                            <a href={monitor.url} target="_blank" rel="noopener noreferrer" style={{ color: muted, display: 'flex' }}>
                              <ExternalLink size={12} />
                            </a>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: muted }}>
                            {monitor.avg_latency_7d != null && <span>{monitor.avg_latency_7d} ms</span>}
                            {uptime !== null && (
                              <span>
                                <strong style={{ color: uptime >= 99 ? '#16a34a' : uptime >= 90 ? '#ca8a04' : '#dc2626' }}>
                                  {uptime.toFixed(2)}%
                                </strong>{' '}
                                uptime
                              </span>
                            )}
                            <span className={`badge ${isUp ? 'badge-up' : 'badge-down'}`}>
                              {isUp ? 'Operacional' : 'Indisponível'}
                            </span>
                          </div>
                        </div>
                        {data.profile.show_uptime_history !== false && (
                          <>
                            <UptimeGrid days={days} totalDays={90} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: muted }}>
                              <span>90 dias atrás</span>
                              <span>Hoje</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Incidents */}
            {data.profile.show_incidents !== false && (data.incidents?.length ?? 0) > 0 && (
              <section style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 16, fontWeight: 650, marginBottom: 12 }}>Incidentes recentes</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.incidents!.map((inc) => (
                    <div key={inc.id} style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{inc.title}</div>
                          <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>
                            {inc.affected_monitor_names.join(', ') || '—'} · {inc.severity} · {inc.status}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: muted, textAlign: 'right' }}>
                          {new Date(inc.opened_at).toLocaleString('pt-BR')}
                          <div>{formatDuration(inc.duration_ms)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Subscribe */}
            <section style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 14, padding: 24, marginBottom: 28 }}>
              <h2 style={{ fontSize: 16, fontWeight: 650, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mail size={16} /> Assinar notificações
              </h2>
              <p style={{ fontSize: 13, color: muted, marginBottom: 12 }}>
                Receba avisos quando houver incidentes nesta página.
              </p>
              <form onSubmit={handleSubscribe} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  className="input"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ flex: 1, minWidth: 200 }}
                />
                <button className="btn btn-primary" type="submit" disabled={subscribing}>
                  {subscribing ? 'Enviando...' : 'Assinar'}
                </button>
              </form>
              {subscribeMsg && <p style={{ fontSize: 13, marginTop: 10, color: muted }}>{subscribeMsg}</p>}
            </section>

            <div style={{ textAlign: 'center', paddingTop: 16, borderTop: `1px solid ${border}` }}>
              <p style={{ fontSize: 12, color: muted }}>
                Monitorado por <strong style={{ color: accent }}>Analytic Pulse</strong>
                {data.profile.custom_domain ? ` · ${data.profile.custom_domain}` : ''}
              </p>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

const StatusPageSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div className="skeleton" style={{ width: 200, height: 32, borderRadius: 8 }} />
      <div className="skeleton" style={{ width: 300, height: 16, borderRadius: 6 }} />
    </div>
    {[1, 2, 3].map((i) => (
      <div key={i} className="glass" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <GridSkeleton />
      </div>
    ))}
  </div>
);
