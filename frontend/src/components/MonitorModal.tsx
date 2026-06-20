import React, { useState } from 'react';
import { X, Globe, Tag, RefreshCw } from 'lucide-react';
import { createMonitor, updateMonitor } from '../services/api';
import type { Monitor } from '../types';

interface MonitorModalProps {
  onClose: () => void;
  onSaved: (monitor: Monitor) => void;
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
        <div className="modal__header">
          <div>
            <h2 className="modal__title">{isEdit ? 'Editar Monitor' : 'Novo Monitor'}</h2>
            <p className="modal__subtitle">
              {isEdit ? 'Altere nome, URL ou intervalo' : 'Adicione uma URL para monitorar'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost modal__close" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal__form">
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
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          <div className="modal-form-grid">
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

          {error && <div className="alert alert--error">{error}</div>}

          <div className="modal__actions">
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
