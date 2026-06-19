import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { getStatusPage } from '../services/api';
import type { StatusPageData } from '../types';
import { UptimeGrid } from '../components/UptimeGrid';
import { GridSkeleton } from '../components/SkeletonLoader';

export const StatusPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<StatusPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    getStatusPage(slug)
      .then(setData)
      .catch(() => setError('Página de status não encontrada.'))
      .finally(() => setLoading(false));
  }, [slug]);

  const allOperational = data?.monitors.every(m => m.status !== 'down') ?? false;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', position: 'relative', overflow: 'hidden' }}>
      {/* Background ambience */}
      <div style={{ position: 'fixed', top: -300, left: '50%', transform: 'translateX(-50%)', width: 800, height: 800, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ maxWidth: 740, margin: '0 auto', padding: '60px 24px', position: 'relative', zIndex: 1 }}>
        {loading ? (
          <StatusPageSkeleton />
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Página não encontrada</h1>
            <p>{error}</p>
          </div>
        ) : data ? (
          <>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(99,102,241,0.35)',
                }}>
                  <Activity size={18} color="#fff" />
                </div>
                <span style={{ fontSize: 18, fontWeight: 700 }}>
                  Ping<span style={{ background: 'linear-gradient(135deg,#6366f1,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Pulse</span>
                </span>
              </div>

              <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
                {data.profile.page_title || `${data.profile.display_name} Status`}
              </h1>
              {data.profile.page_description && (
                <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto' }}>
                  {data.profile.page_description}
                </p>
              )}

              {/* Overall status banner */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                marginTop: 24,
                padding: '12px 24px',
                borderRadius: 99,
                background: allOperational
                  ? 'linear-gradient(135deg,rgba(34,197,94,0.12),rgba(34,197,94,0.06))'
                  : 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(239,68,68,0.06))',
                border: `1px solid ${allOperational ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>
                <span className={`pulse-dot ${allOperational ? 'pulse-dot-green' : 'pulse-dot-red'}`} />
                <span style={{
                  fontSize: 15, fontWeight: 600,
                  color: allOperational ? 'var(--green)' : 'var(--red)',
                }}>
                  {allOperational ? '✓ Todos os sistemas operacionais' : '⚠ Degradação detectada'}
                </span>
              </div>
            </div>

            {/* Monitors */}
            {data.monitors.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum monitor configurado.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {data.monitors.map((monitor, idx) => {
                  const days = data.uptime_grids[monitor.id] ?? [];
                  const isUp = monitor.status !== 'down';
                  const uptime = monitor.uptime_90d ? Number(monitor.uptime_90d) : null;

                  return (
                    <div key={monitor.id} className="animate-fade-in-up" style={{ animationDelay: `${idx * 80}ms` }}>
                      <div className="glass" style={{ padding: '20px 24px', marginBottom: 12 }}>
                        {/* Monitor row */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {isUp
                              ? <CheckCircle size={16} color="var(--green)" />
                              : <XCircle size={16} color="var(--red)" />
                            }
                            <span style={{ fontWeight: 600, fontSize: 15 }}>{monitor.name}</span>
                            <a href={monitor.url} target="_blank" rel="noopener noreferrer"
                              style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                              <ExternalLink size={12} />
                            </a>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {uptime !== null && (
                              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                <span style={{ fontWeight: 600, color: uptime >= 99 ? 'var(--green)' : uptime >= 90 ? 'var(--yellow)' : 'var(--red)' }}>
                                  {uptime.toFixed(2)}%
                                </span>
                                {' '}uptime
                              </span>
                            )}
                            <span className={`badge ${isUp ? 'badge-up' : 'badge-down'}`} style={{ fontSize: 11 }}>
                              {isUp ? 'Operacional' : 'Indisponível'}
                            </span>
                          </div>
                        </div>

                        {/* 90-day grid */}
                        <UptimeGrid days={days} totalDays={90} />

                        {/* Grid legend */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                          <span>90 dias atrás</span>
                          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--green)', display: 'inline-block' }} /> Online
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--yellow)', display: 'inline-block' }} /> Parcial
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--red)', display: 'inline-block' }} /> Offline
                            </span>
                          </div>
                          <span>Hoje</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            <div style={{ textAlign: 'center', marginTop: 56, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Monitorado por{' '}
                <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>PingPulse</span>
              </p>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

// ── Skeleton ─────────────────────────────────────────────────────────────────
const StatusPageSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div className="skeleton" style={{ width: 200, height: 32, borderRadius: 8 }} />
      <div className="skeleton" style={{ width: 300, height: 16, borderRadius: 6 }} />
      <div className="skeleton" style={{ width: 240, height: 42, borderRadius: 99 }} />
    </div>
    {[1, 2, 3].map(i => (
      <div key={i} className="glass" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div className="skeleton" style={{ width: 160, height: 18 }} />
          <div className="skeleton" style={{ width: 80, height: 22, borderRadius: 99 }} />
        </div>
        <GridSkeleton />
      </div>
    ))}
  </div>
);
