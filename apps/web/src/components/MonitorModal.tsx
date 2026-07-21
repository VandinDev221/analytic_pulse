import React, { useMemo, useState } from 'react';
import { X, Globe, Tag, RefreshCw, Shield, Server } from 'lucide-react';
import { createMonitor, updateMonitor } from '../services/api';
import type { CheckType, DnsRecordType, Monitor } from '../types';

interface MonitorModalProps {
  onClose: () => void;
  onSaved: (monitor: Monitor) => void;
  monitor?: Monitor;
}

const CHECK_OPTIONS: Array<{ value: CheckType; label: string }> = [
  { value: 'http', label: 'HTTP' },
  { value: 'https', label: 'HTTPS' },
  { value: 'tcp', label: 'TCP' },
  { value: 'port', label: 'Port' },
  { value: 'ping', label: 'PING' },
  { value: 'dns', label: 'DNS' },
  { value: 'ssl', label: 'SSL / TLS' },
];

const DNS_OPTIONS: DnsRecordType[] = [
  'A',
  'AAAA',
  'MX',
  'TXT',
  'CNAME',
  'NS',
  'SPF',
  'DKIM',
  'DMARC',
  'DNSSEC',
];

function isHttpType(t: CheckType) {
  return t === 'http' || t === 'https';
}

function needsPort(t: CheckType) {
  return t === 'tcp' || t === 'port' || t === 'ssl';
}

export const MonitorModal: React.FC<MonitorModalProps> = ({ onClose, onSaved, monitor }) => {
  const isEdit = !!monitor;

  const [form, setForm] = useState({
    name: monitor?.name ?? '',
    url: monitor?.url ?? '',
    method: monitor?.method ?? 'GET',
    interval_minutes: monitor?.interval_minutes ?? 5,
    check_type: (monitor?.check_type ?? 'https') as CheckType,
    host: monitor?.host ?? '',
    port: monitor?.port ?? (monitor?.check_type === 'ssl' ? 443 : 80),
    dns_record_type: (monitor?.dns_record_type ?? 'A') as DnsRecordType,
    keyword: monitor?.keyword ?? '',
    expected_header_name: monitor?.expected_header_name ?? '',
    expected_header_value: monitor?.expected_header_value ?? '',
    json_path: monitor?.json_path ?? '',
    json_expected: monitor?.json_expected ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const httpMode = useMemo(() => isHttpType(form.check_type), [form.check_type]);

  function set(field: string, value: string | number) {
    setForm((f) => ({ ...f, [field]: value }));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Nome é obrigatório.');
      return;
    }

    const target = httpMode ? form.url.trim() : (form.host.trim() || form.url.trim());
    if (!target) {
      setError(httpMode ? 'URL é obrigatória.' : 'Host é obrigatório.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        url: httpMode ? form.url.trim() : target,
        method: form.method,
        interval_minutes: form.interval_minutes,
        check_type: form.check_type,
        host: httpMode ? undefined : form.host.trim() || target,
        port: needsPort(form.check_type) ? Number(form.port) || undefined : undefined,
        dns_record_type: form.check_type === 'dns' ? form.dns_record_type : undefined,
        keyword: httpMode && form.keyword.trim() ? form.keyword.trim() : undefined,
        expected_header_name:
          httpMode && form.expected_header_name.trim()
            ? form.expected_header_name.trim()
            : undefined,
        expected_header_value:
          httpMode && form.expected_header_value.trim()
            ? form.expected_header_value.trim()
            : undefined,
        json_path: httpMode && form.json_path.trim() ? form.json_path.trim() : undefined,
        json_expected:
          httpMode && form.json_expected.trim() ? form.json_expected.trim() : undefined,
      };

      const saved = isEdit
        ? await updateMonitor(monitor!.id, payload)
        : await createMonitor(payload);
      onSaved(saved);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar monitor.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal__header">
          <div>
            <h2 className="modal__title">{isEdit ? 'Editar Monitor' : 'Novo Monitor'}</h2>
            <p className="modal__subtitle">
              HTTP, TCP, DNS, SSL, PING e validações de resposta
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
              placeholder="ex: API Produção"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <Shield size={12} style={{ display: 'inline', marginRight: 4 }} />
              Tipo de check
            </label>
            <select
              className="input"
              value={form.check_type}
              onChange={(e) => set('check_type', e.target.value)}
            >
              {CHECK_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {httpMode ? (
            <div className="form-group">
              <label className="form-label">
                <Globe size={12} style={{ display: 'inline', marginRight: 4 }} />
                URL
              </label>
              <input
                className="input"
                placeholder="https://meusite.com/health"
                value={form.url}
                onChange={(e) => set('url', e.target.value)}
                type="url"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
          ) : (
            <div className="modal-form-grid">
              <div className="form-group">
                <label className="form-label">
                  <Server size={12} style={{ display: 'inline', marginRight: 4 }} />
                  Host
                </label>
                <input
                  className="input"
                  placeholder="api.exemplo.com"
                  value={form.host}
                  onChange={(e) => set('host', e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
              {needsPort(form.check_type) && (
                <div className="form-group">
                  <label className="form-label">Porta</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={65535}
                    value={form.port}
                    onChange={(e) => set('port', Number(e.target.value))}
                  />
                </div>
              )}
            </div>
          )}

          <div className="modal-form-grid">
            {httpMode && (
              <div className="form-group">
                <label className="form-label">Método HTTP</label>
                <select className="input" value={form.method} onChange={(e) => set('method', e.target.value)}>
                  <option>GET</option>
                  <option>HEAD</option>
                  <option>POST</option>
                </select>
              </div>
            )}
            {form.check_type === 'dns' && (
              <div className="form-group">
                <label className="form-label">Registro DNS</label>
                <select
                  className="input"
                  value={form.dns_record_type}
                  onChange={(e) => set('dns_record_type', e.target.value)}
                >
                  {DNS_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">
                <RefreshCw size={12} style={{ display: 'inline', marginRight: 4 }} />
                Intervalo
              </label>
              <select
                className="input"
                value={form.interval_minutes}
                onChange={(e) => set('interval_minutes', Number(e.target.value))}
              >
                <option value={1}>1 minuto</option>
                <option value={5}>5 minutos</option>
                <option value={10}>10 minutos</option>
                <option value={30}>30 minutos</option>
                <option value={60}>1 hora</option>
              </select>
            </div>
          </div>

          {httpMode && (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? 'Ocultar validações' : 'Validações avançadas'}
              </button>
              {showAdvanced && (
                <>
                  <div className="form-group">
                    <label className="form-label">Keyword no body</label>
                    <input
                      className="input"
                      placeholder='ex: "status":"ok"'
                      value={form.keyword}
                      onChange={(e) => set('keyword', e.target.value)}
                    />
                  </div>
                  <div className="modal-form-grid">
                    <div className="form-group">
                      <label className="form-label">Header esperado</label>
                      <input
                        className="input"
                        placeholder="content-type"
                        value={form.expected_header_name}
                        onChange={(e) => set('expected_header_name', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Valor do header</label>
                      <input
                        className="input"
                        placeholder="application/json"
                        value={form.expected_header_value}
                        onChange={(e) => set('expected_header_value', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="modal-form-grid">
                    <div className="form-group">
                      <label className="form-label">JSON path</label>
                      <input
                        className="input"
                        placeholder="status"
                        value={form.json_path}
                        onChange={(e) => set('json_path', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">JSON expected</label>
                      <input
                        className="input"
                        placeholder="ok"
                        value={form.json_expected}
                        onChange={(e) => set('json_expected', e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {error && <div className="alert alert--error">{error}</div>}

          <div className="modal__actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
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
