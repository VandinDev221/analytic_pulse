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
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' }}>Monitores</h1>
            {!loading && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 11, color: 'var(--green)', fontWeight: 600,
                background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)',
                borderRadius: 99, padding: '3px 10px',
              }}>
                <Radio size={10} style={{ animation: 'pulse 2s ease-in-out infinite' }} />
                Ao vivo
              </span>
            )}
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Gerencie e acompanhe a disponibilidade dos seus serviços.
            {lastUpdated && (
              <span style={{ display: 'block', fontSize: 12, marginTop: 4, color: 'var(--text-muted)' }}>
                Atualizado {lastUpdated.toLocaleTimeString('pt-BR')}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => loadMonitors()} disabled={refreshing}>
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Atualizar
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={15} /> Novo Monitor
          </button>
        </div>
      </div>

      {!loading && monitors.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total', value: monitors.length, icon: <Activity size={15} />, color: 'var(--accent-light)' },
            { label: 'Online',  value: upCount,   icon: <CheckCircle size={15} />, color: 'var(--green)' },
            { label: 'Offline', value: downCount, icon: <AlertTriangle size={15} />, color: downCount > 0 ? 'var(--red)' : 'var(--text-muted)' },
          ].map(s => (
            <div key={s.label} className="glass-sm" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: s.color }}>{s.icon}</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.label}</span>
            </div>
          ))}

          <div className="glass-sm" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <span className={`pulse-dot ${allUp ? 'pulse-dot-green' : 'pulse-dot-red'}`} />
            <span style={{ fontSize: 13, fontWeight: 600, color: allUp ? 'var(--green)' : 'var(--red)' }}>
              {allUp ? 'Todos operacionais' : `${downCount} com problemas`}
            </span>
          </div>
        </div>
      )}

      {userSlug && (
        <div className="glass-sm" style={{ padding: '12px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link2 size={14} color="var(--accent-light)" />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Sua página pública:</span>
          <a
            href={`/status/${userSlug}`}
            target="_blank"
            style={{ fontSize: 13, color: 'var(--accent-light)', textDecoration: 'none', fontWeight: 500 }}
          >
            /status/{userSlug}
          </a>
        </div>
      )}

      {loading ? (
        <DashboardSkeleton />
      ) : monitors.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '80px 40px', gap: 16, textAlign: 'center',
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
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={15} /> Criar primeiro monitor
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
