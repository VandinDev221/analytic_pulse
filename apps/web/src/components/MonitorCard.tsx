import React, { useState } from 'react';
import { ExternalLink, Trash2, Activity, Clock, ToggleLeft, ToggleRight, ChevronRight, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@analytic-pulse/ui';
import type { Monitor } from '../types';
import { deleteMonitor, toggleMonitorStatus } from '../services/api';

interface MonitorCardProps {
  monitor: Monitor;
  onDeleted: (id: string) => void;
  onUpdated: (monitor: Monitor) => void;
  onEdit: (monitor: Monitor) => void;
}

function StatusBadge({ status }: { status: Monitor['status'] }) {
  if (status === 'up') {
    return (
      <Badge tone="up">
        <span className="pulse-dot pulse-dot-green" />
        Online
      </Badge>
    );
  }
  if (status === 'down') {
    return (
      <Badge tone="down">
        <span className="pulse-dot pulse-dot-red" />
        Offline
      </Badge>
    );
  }
  if (status === 'active') {
    return <Badge tone="active">Aguardando</Badge>;
  }
  if (status === 'inactive') {
    return <Badge tone="inactive">Pausado</Badge>;
  }
  return <Badge tone="unknown">Desconhecido</Badge>;
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
    <div className={`glass animate-fade-in-up monitor-card ${isActive ? '' : 'monitor-card--inactive'}`}>
      <div className="monitor-card__header">
        <div className="monitor-card__info">
          <div className="monitor-card__icon">
            <Activity size={16} color="#818cf8" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="monitor-card__name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {monitor.name}
              <span className="badge badge-unknown" style={{ fontSize: 9, textTransform: 'uppercase' }}>
                {monitor.check_type || 'http'}
              </span>
            </div>
            {monitor.check_type === 'http' || monitor.check_type === 'https' || !monitor.check_type ? (
              <a
                href={monitor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="monitor-card__url"
              >
                <span>{monitor.url}</span>
                <ExternalLink size={10} style={{ flexShrink: 0 }} />
              </a>
            ) : (
              <div className="monitor-card__url">
                <span>
                  {monitor.host || monitor.url}
                  {monitor.port ? `:${monitor.port}` : ''}
                </span>
              </div>
            )}
          </div>
        </div>
        <StatusBadge status={monitor.status} />
      </div>

      <div className="monitor-card__stats">
        {monitor.last_response_time_ms !== undefined && monitor.last_response_time_ms !== null ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} />
            {monitor.last_response_time_ms} ms
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>Sem verificação ainda</span>
        )}
        <span>A cada {monitor.interval_minutes} min</span>
        {monitor.last_checked_at && (
          <span>
            Última: {new Date(monitor.last_checked_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="monitor-card__actions">
        <button
          className="btn btn-ghost"
          onClick={handleToggle}
          disabled={toggling}
          title={isActive ? 'Pausar' : 'Ativar'}
        >
          {isActive
            ? <><ToggleRight size={14} /> Pausar</>
            : <><ToggleLeft size={14} /> Ativar</>
          }
        </button>
        <button className="btn btn-ghost" onClick={() => onEdit(monitor)} title="Editar">
          <Pencil size={13} /> Editar
        </button>
        <button className="btn btn-ghost" onClick={() => navigate(`/monitors/${monitor.id}`)}>
          Detalhes <ChevronRight size={14} />
        </button>
        <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
          <Trash2 size={13} />
          {deleting ? '...' : 'Remover'}
        </button>
      </div>
    </div>
  );
};
