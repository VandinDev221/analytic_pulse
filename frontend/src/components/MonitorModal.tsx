import React, { useState } from 'react';
import { X, Globe, Tag, RefreshCw } from 'lucide-react';
import { createMonitor, updateMonitor } from '../services/api';
import type { Monitor } from '../types';

interface MonitorModalProps {
  onClose: () => void;
  onSaved: (monitor: Monitor) => void;
  /** Se informado, abre em modo edição */
  monitor?: Monitor;
}

export const MonitorModal: React.FC<MonitorModalProps> = ({ onClose, onSaved, monitor }) => {
  const isEdit = !!monitor;

  const [form, setForm] = useState({
    name: monitor?.name ?? '',
    url: monitor?.url ?? '',
    method: monitor?.method ?? 'GET',
    interval_minutes: monitor?.interval_minutes ?? 5,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(field: string, value: string | number) {
    setForm(f => ({ ...f, [field]: value }));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.url.trim()) {
      setError('Nome e URL são obrigatórios.');
      return;
    }
    setLoading(true);
    try {
      const saved = isEdit
        ? await updateMonitor(monitor!.id, form)
        : await createMonitor(form);
      onSaved(saved);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar monitor.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              {isEdit ? 'Editar Monitor' : 'Novo Monitor'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              {isEdit ? 'Altere nome, URL ou intervalo' : 'Adicione uma URL para monitorar'}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: 8, width: 34, height: 34 }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">
              <Tag size={12} style={{ display: 'inline', marginRight: 4 }} />
              Nome do serviço
            </label>
            <input
              className="input"
              placeholder="ex: Meu Site Principal"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <Globe size={12} style={{ display: 'inline', marginRight: 4 }} />
              URL
            </label>
            <input
              className="input"
              placeholder="https://meusite.com"
              value={form.url}
              onChange={e => set('url', e.target.value)}
              type="url"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Método HTTP</label>
              <select className="input" value={form.method} onChange={e => set('method', e.target.value)}>
                <option>GET</option>
                <option>HEAD</option>
                <option>POST</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">
                <RefreshCw size={12} style={{ display: 'inline', marginRight: 4 }} />
                Intervalo
              </label>
              <select className="input" value={form.interval_minutes} onChange={e => set('interval_minutes', Number(e.target.value))}>
                <option value={1}>1 minuto</option>
                <option value={5}>5 minutos</option>
                <option value={10}>10 minutos</option>
                <option value={30}>30 minutos</option>
                <option value={60}>1 hora</option>
              </select>
            </div>
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar Monitor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/** @deprecated use MonitorModal */
export const AddMonitorModal = MonitorModal;
