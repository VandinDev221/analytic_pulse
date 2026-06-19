import React, { useState } from 'react';
import { ExternalLink, Trash2, Activity, Clock, ToggleLeft, ToggleRight, ChevronRight, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Monitor } from '../types';
import { deleteMonitor, toggleMonitorStatus } from '../services/api';

interface MonitorCardProps {
  monitor: Monitor;
  onDeleted: (id: string) => void;
  onUpdated: (monitor: Monitor) => void;
  onEdit: (monitor: Monitor) => void;
}

function StatusBadge({ status }: { status: Monitor['status'] }) {
  if (status === 'up') return (
    <span className="badge badge-up">
      <span className="pulse-dot pulse-dot-green" />
      Online
    </span>
  );
  if (status === 'down') return (
    <span className="badge badge-down">
      <span className="pulse-dot pulse-dot-red" />
      Offline
    </span>
  );
  if (status === 'active') return (
    <span className="badge badge-active">Aguardando</span>
  );
  return <span className="badge badge-unknown">Desconhecido</span>;
}

export const MonitorCard: React.FC<MonitorCardProps> = ({ monitor, onDeleted, onUpdated, onEdit }) => {
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const navigate = useNavigate();

  const isActive = monitor.status !== 'inactive';

  async function handleDelete() {
    if (!confirm(`Remover monitor "${monitor.name}"?`)) return;
    setDeleting(true);
    try {
      await deleteMonitor(monitor.id);
      onDeleted(monitor.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao remover monitor.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggle() {
    setToggling(true);
    try {
      const updated = await toggleMonitorStatus(monitor.id, !isActive);
      onUpdated(updated);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div
      className="glass animate-fade-in-up"
      style={{
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        opacity: isActive ? 1 : 0.55,
        transition: 'opacity 0.3s',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.2))',
              border: '1px solid rgba(99,102,241,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Activity size={16} color="#818cf8" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {monitor.name}
            </div>
            <a
              href={monitor.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3, transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-light)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{monitor.url}</span>
              <ExternalLink size={10} />
            </a>
          </div>
        </div>
        <StatusBadge status={monitor.status} />
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--text-secondary)' }}>
        {monitor.last_response_time_ms !== undefined && monitor.last_response_time_ms !== null ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} />
            {monitor.last_response_time_ms} ms
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>Sem verificação ainda</span>
        )}
        <span style={{ color: 'var(--text-muted)' }}>•</span>
        <span>A cada {monitor.interval_minutes} min</span>
        {monitor.last_checked_at && (
          <>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span>
              Última: {new Date(monitor.last_checked_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid var(--border)' }}>
        <button
          className="btn btn-ghost"
          style={{ padding: '6px 12px', fontSize: 12 }}
          onClick={handleToggle}
          disabled={toggling}
          title={isActive ? 'Pausar' : 'Ativar'}
        >
          {isActive
            ? <><ToggleRight size={14} /> Pausar</>
            : <><ToggleLeft size={14} /> Ativar</>
          }
        </button>
        <button
          className="btn btn-ghost"
          style={{ padding: '6px 12px', fontSize: 12 }}
          onClick={() => onEdit(monitor)}
          title="Editar"
        >
          <Pencil size={13} /> Editar
        </button>
        <button
          className="btn btn-ghost"
          style={{ padding: '6px 12px', fontSize: 12 }}
          onClick={() => navigate(`/monitors/${monitor.id}`)}
        >
          Detalhes <ChevronRight size={14} />
        </button>
        <button
          className="btn btn-danger"
          style={{ padding: '6px 12px', fontSize: 12 }}
          onClick={handleDelete}
          disabled={deleting}
        >
          <Trash2 size={13} />
          {deleting ? '...' : 'Remover'}
        </button>
      </div>
    </div>
  );
};
