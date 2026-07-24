import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Radio,
  ShieldAlert,
} from 'lucide-react';
import { getIncidents } from '../services/api';
import type { Incident, IncidentStatus } from '../types';
import { useLiveData } from '../hooks/useLiveData';

type Filter = 'active' | 'resolved' | 'all';

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

function statusTone(status: IncidentStatus): string {
  switch (status) {
    case 'open':
      return 'badge-down';
    case 'acknowledged':
    case 'investigating':
      return 'badge-active';
    case 'resolved':
      return 'badge-up';
    default:
      return 'badge-unknown';
  }
}

export const IncidentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('active');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    async (silent = false) => {
      try {
        const statusParam =
          filter === 'active' ? 'active' : filter === 'resolved' ? 'resolved' : 'all';
        const data = await getIncidents(statusParam);
        setIncidents(data);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar incidentes');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [filter]
  );

  useEffect(() => {
    setLoading(true);
    load(false);
  }, [load]);

  useLiveData(() => load(true), !loading);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Incidentes</h1>
          <p className="page-subtitle">Timeline, severidade e serviços afetados</p>
        </div>
      </div>

      <div className="filter-tabs">
        {(
          [
            { id: 'active', label: 'Ativos' },
            { id: 'resolved', label: 'Resolvidos' },
            { id: 'all', label: 'Todos' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`btn ${filter === tab.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 88, borderRadius: 14 }} />
          ))}
        </div>
      ) : incidents.length === 0 ? (
        <div className="glass" style={{ padding: 48, textAlign: 'center' }}>
          <CheckCircle2 size={28} color="var(--green)" style={{ marginBottom: 12 }} />
          <h2 style={{ fontSize: 18, marginBottom: 6 }}>Nenhum incidente</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Quando um monitor cair, um incidente será aberto automaticamente.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {incidents.map((incident) => (
            <button
              key={incident.id}
              type="button"
              className="glass"
              onClick={() => navigate(`/incidents/${incident.id}`)}
              style={{
                padding: 20,
                textAlign: 'left',
                cursor: 'pointer',
                border: '1px solid var(--border)',
                width: '100%',
              }}
            >
              <div className="incident-list-card">
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <ShieldAlert size={16} color="var(--red)" />
                    <span style={{ fontWeight: 650, fontSize: 15, wordBreak: 'break-word' }}>{incident.title}</span>
                    <span className={`badge ${statusTone(incident.status)}`}>{incident.status}</span>
                    <span className="badge badge-unknown">{incident.severity}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {incident.affected_monitors.map((m) => m.name).join(', ') || 'Sem serviços'}
                  </div>
                </div>
                <div className="incident-list-card__meta">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                    <Clock size={12} />
                    {formatDuration(incident.duration_ms)}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    {new Date(incident.opened_at).toLocaleString('pt-BR')}
                  </div>
                  {incident.status !== 'resolved' && (
                    <div style={{ marginTop: 6, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      <Radio size={10} /> Ao vivo
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {!loading && incidents.some((i) => i.status !== 'resolved') && (
        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={12} /> Incidentes abrem e resolvem automaticamente com o status dos monitores.
        </p>
      )}
    </div>
  );
};
