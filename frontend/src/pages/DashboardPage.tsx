import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, Activity, CheckCircle, AlertTriangle, Link2 } from 'lucide-react';
import { getMonitors } from '../services/api';
import type { Monitor } from '../types';
import { MonitorCard } from '../components/MonitorCard';
import { AddMonitorModal } from '../components/AddMonitorModal';
import { DashboardSkeleton } from '../components/SkeletonLoader';
import { supabase } from '../lib/supabase';

export const DashboardPage: React.FC = () => {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userSlug, setUserSlug] = useState('');

  async function loadMonitors() {
    try {
      const data = await getMonitors();
      setMonitors(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadSlug() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('slug').eq('user_id', user.id).single();
      if (profile?.slug) setUserSlug(profile.slug);
    }
  }

  useEffect(() => { loadMonitors(); loadSlug(); }, []);

  function handleRefresh() {
    setRefreshing(true);
    loadMonitors();
  }

  // Stats
  const upCount   = monitors.filter(m => m.status === 'up').length;
  const downCount = monitors.filter(m => m.status === 'down').length;
  const allUp     = downCount === 0 && monitors.length > 0;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Monitores</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Gerencie e acompanhe a disponibilidade dos seus serviços.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button id="refresh-btn" className="btn btn-ghost" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Atualizar
          </button>
          <button id="add-monitor-btn" className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={15} /> Novo Monitor
          </button>
        </div>
      </div>

      {/* Stats bar */}
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

          {/* Overall status pill */}
          <div className="glass-sm" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <span className={`pulse-dot ${allUp ? 'pulse-dot-green' : 'pulse-dot-red'}`} />
            <span style={{ fontSize: 13, fontWeight: 600, color: allUp ? 'var(--green)' : 'var(--red)' }}>
              {allUp ? 'Todos operacionais' : `${downCount} com problemas`}
            </span>
          </div>
        </div>
      )}

      {/* Status page link */}
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

      {/* Monitor list */}
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
          <button id="first-monitor-btn" className="btn btn-primary" onClick={() => setShowModal(true)}>
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
              />
            </div>
          ))}
        </div>
      )}

      {/* Add Monitor Modal */}
      {showModal && (
        <AddMonitorModal
          onClose={() => setShowModal(false)}
          onCreated={monitor => setMonitors(prev => [monitor, ...prev])}
        />
      )}
    </div>
  );
};
