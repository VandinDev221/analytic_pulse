import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';
import {
  acknowledgeIncident,
  getIncident,
  resolveIncident,
  addIncidentComment,
  updateIncident,
} from '../services/api';
import type {
  IncidentDetail,
  IncidentSeverity,
  IncidentTimelineEvent,
} from '../types';
import { useLiveData } from '../hooks/useLiveData';
import { IncidentAiAnalysisCard } from '../components/IncidentAiAnalysisCard';

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m`;
}

function eventLabel(event: IncidentTimelineEvent): string {
  return event.message;
}

export const IncidentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('major');

  const load = useCallback(
    async (silent = false) => {
      if (!id) return;
      try {
        const data = await getIncident(id);
        setIncident(data);
        setNotes(data.notes ?? '');
        setRootCause(data.root_cause ?? '');
        setSeverity(data.severity);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Incidente não encontrado');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    setLoading(true);
    load(false);
  }, [load]);

  useLiveData(() => load(true), !loading && !!id);

  async function handleAcknowledge() {
    if (!id) return;
    setSaving(true);
    try {
      const data = await acknowledgeIncident(id);
      setIncident(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao acknowledge');
    } finally {
      setSaving(false);
    }
  }

  async function handleResolve() {
    if (!id) return;
    setSaving(true);
    try {
      const data = await resolveIncident(id);
      setIncident(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao resolver');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMeta() {
    if (!id) return;
    setSaving(true);
    try {
      const data = await updateIncident(id, {
        notes,
        root_cause: rootCause,
        severity,
      });
      setIncident(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !comment.trim()) return;
    setSaving(true);
    try {
      const data = await addIncidentComment(id, comment.trim());
      setIncident(data);
      setComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao comentar');
    } finally {
      setSaving(false);
    }
  }

  if (!loading && !incident) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
        <h2 style={{ color: 'var(--text-secondary)' }}>Incidente não encontrado</h2>
        <button className="btn btn-ghost" onClick={() => navigate('/incidents')} style={{ marginTop: 16 }}>
          ← Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <button className="btn btn-ghost" onClick={() => navigate('/incidents')} style={{ marginBottom: 20 }}>
        <ArrowLeft size={14} /> Voltar
      </button>

      {loading || !incident ? (
        <div className="skeleton" style={{ height: 220, borderRadius: 16 }} />
      ) : (
        <>
          <div className="glass detail-card" style={{ padding: 28, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="detail-card__title-row" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <ShieldAlert size={22} color="var(--red)" style={{ flexShrink: 0 }} />
                  <h1 style={{ fontSize: 22, fontWeight: 700, wordBreak: 'break-word' }}>{incident.title}</h1>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span className="badge badge-down">{incident.status}</span>
                  <span className="badge badge-unknown">{incident.severity}</span>
                  {incident.tags.map((tag) => (
                    <span key={tag} className="badge badge-active">{tag}</span>
                  ))}
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Aberto {new Date(incident.opened_at).toLocaleString('pt-BR')} · Duração{' '}
                  {formatDuration(incident.duration_ms)}
                  {incident.recovered_at
                    ? ` · Recuperado ${new Date(incident.recovered_at).toLocaleString('pt-BR')}`
                    : ''}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {incident.status === 'open' && (
                  <button className="btn btn-ghost" disabled={saving} onClick={handleAcknowledge}>
                    Acknowledge
                  </button>
                )}
                {incident.status !== 'resolved' && (
                  <button className="btn btn-primary" disabled={saving} onClick={handleResolve}>
                    <CheckCircle2 size={14} /> Resolver
                  </button>
                )}
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Serviços afetados</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {incident.affected_monitors.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => navigate(`/monitors/${m.id}`)}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}

          <div className="incident-detail-grid">
            {/* Timeline */}
            <div className="glass" style={{ padding: 28 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Timeline</h2>
              <div className="incident-timeline">
                {incident.timeline.map((event, index) => (
                  <div key={event.id} className="incident-timeline__item">
                    <div className="incident-timeline__rail">
                      <span className="incident-timeline__dot" />
                      {index < incident.timeline.length - 1 && (
                        <span className="incident-timeline__line" />
                      )}
                    </div>
                    <div className="incident-timeline__content">
                      <div className="incident-timeline__time">
                        {new Date(event.created_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                      <div className="incident-timeline__type">{event.event_type}</div>
                      <div className="incident-timeline__message">{eventLabel(event)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Meta + comments */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <IncidentAiAnalysisCard
                incidentId={incident.id}
                initialAnalysis={incident.ai_analysis}
                initialStatus={incident.ai_analysis_status}
                onRefresh={() => load(true)}
              />

              <div className="glass" style={{ padding: 24 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Detalhes</h2>
                <div className="form-group">
                  <label className="form-label">Severidade</label>
                  <select
                    className="input"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                  >
                    {['critical', 'high', 'major', 'minor', 'low'].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Root cause</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={rootCause}
                    onChange={(e) => setRootCause(e.target.value)}
                    placeholder="Causa raiz conhecida..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas internas..."
                  />
                </div>
                <button className="btn btn-primary" disabled={saving} onClick={handleSaveMeta}>
                  Salvar detalhes
                </button>
              </div>

              <div className="glass" style={{ padding: 24 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MessageSquare size={16} /> Comentários
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                  {incident.comments.length === 0 && (
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nenhum comentário ainda.</p>
                  )}
                  {incident.comments.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-base)',
                      }}
                    >
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                        {c.author_email || c.user_id} ·{' '}
                        {new Date(c.created_at).toLocaleString('pt-BR')}
                      </div>
                      <div style={{ fontSize: 14 }}>{c.body}</div>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleComment}>
                  <textarea
                    className="input"
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Adicionar comentário..."
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ marginTop: 10 }}
                    disabled={saving || !comment.trim()}
                  >
                    Comentar
                  </button>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
