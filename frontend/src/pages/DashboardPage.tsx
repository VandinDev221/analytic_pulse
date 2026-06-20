import React, { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Activity, CheckCircle, AlertTriangle, Link2, Radio } from 'lucide-react';
import { getMonitors, getMe } from '../services/api';
import type { Monitor } from '../types';
import { MonitorCard } from '../components/MonitorCard';
import { MonitorModal } from '../components/MonitorModal';
import { DashboardSkeleton } from '../components/SkeletonLoader';
import { usePolling, POLL_INTERVAL_MS } from '../hooks/usePolling';

export const DashboardPage: React.FC = () => {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState<Monitor | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [userSlug, setUserSlug] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadMonitors = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const data = await getMonitors();
      setMonitors(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMonitors();
    getMe()
      .then(u => { if (u?.slug) setUserSlug(u.slug); })
      .catch(console.error);
  }, [loadMonitors]);

  usePolling(() => loadMonitors(true), POLL_INTERVAL_MS, !loading);

  const upCount   = monitors.filter(m => m.status === 'up').length;
  const downCount = monitors.filter(m => m.status === 'down').length;
  const allUp     = downCount === 0 && monitors.length > 0;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-header__title-row">
            <h1>Monitores</h1>
            {!loading && (
              <span className="live-badge">
                <Radio size={10} style={{ animation: 'pulse 2s ease-in-out infinite' }} />
                Ao vivo
              </span>
            )}
          </div>
          <p className="page-header__desc">
            Gerencie e acompanhe a disponibilidade dos seus serviços.
            {lastUpdated && (
              <span className="page-header__updated">
                Atualizado {lastUpdated.toLocaleTimeString('pt-BR')}
              </span>
            )}
          </p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn-ghost" onClick={() => loadMonitors()} disabled={refreshing}>
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Atualizar
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={15} /> Novo
          </button>
        </div>
      </div>

      {!loading && monitors.length > 0 && (
        <div className="stats-row">
          {[
            { label: 'Total', value: monitors.length, icon: <Activity size={15} />, color: 'var(--accent-light)' },
            { label: 'Online',  value: upCount,   icon: <CheckCircle size={15} />, color: 'var(--green)' },
            { label: 'Offline', value: downCount, icon: <AlertTriangle size={15} />, color: downCount > 0 ? 'var(--red)' : 'var(--text-muted)' },
          ].map(s => (
            <div key={s.label} className="glass-sm stat-chip">
              <span style={{ color: s.color }}>{s.icon}</span>
              <span className="stat-chip__value" style={{ color: s.color }}>{s.value}</span>
              <span className="stat-chip__label">{s.label}</span>
            </div>
          ))}

          <div className="glass-sm stat-chip stat-chip--status">
            <span className={`pulse-dot ${allUp ? 'pulse-dot-green' : 'pulse-dot-red'}`} />
            <span style={{ fontSize: 13, fontWeight: 600, color: allUp ? 'var(--green)' : 'var(--red)' }}>
              {allUp ? 'Todos operacionais' : `${downCount} com problemas`}
            </span>
          </div>
        </div>
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

      {loading ? (
        <DashboardSkeleton />
      ) : monitors.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '60px 20px', gap: 16, textAlign: 'center',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.1))',
            border: '1px solid rgba(99,102,241,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Activity size={32} color="#6366f1" />
          </div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Nenhum monitor ainda</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 320 }}>
              Adicione seu primeiro site ou API para começar a monitorar a disponibilidade.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ minHeight: 48 }}>
            <Plus size={15} /> Criar primeiro monitor
          </button>
        </div>
      ) : (
        <div className="monitor-list">
          {monitors.map((m, i) => (
            <div key={m.id} style={{ animationDelay: `${i * 60}ms` }}>
              <MonitorCard
                monitor={m}
                onDeleted={id => setMonitors(prev => prev.filter(x => x.id !== id))}
                onUpdated={updated => setMonitors(prev => prev.map(x => x.id === updated.id ? updated : x))}
                onEdit={setEditingMonitor}
              />
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <MonitorModal
          onClose={() => setShowModal(false)}
          onSaved={monitor => setMonitors(prev => [monitor, ...prev])}
        />
      )}

      {editingMonitor && (
        <MonitorModal
          monitor={editingMonitor}
          onClose={() => setEditingMonitor(null)}
          onSaved={updated => {
            setMonitors(prev => prev.map(x => x.id === updated.id ? updated : x));
            setEditingMonitor(null);
          }}
        />
      )}
    </div>
  );
};
