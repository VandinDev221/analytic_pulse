import React, { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  Plus,
  Trash2,
  Zap,
} from 'lucide-react';
import {
  createAlertChannel,
  createAlertRule,
  deleteAlertChannel,
  deleteAlertRule,
  getAlertChannels,
  getAlertDeliveries,
  getAlertRules,
  getMonitors,
} from '../services/api';
import type {
  AlertChannel,
  AlertChannelKind,
  AlertDelivery,
  AlertMetric,
  AlertOperator,
  AlertRule,
  Monitor,
} from '../types';
import { useLiveData } from '../hooks/useLiveData';

const CHANNEL_KINDS: AlertChannelKind[] = [
  'telegram',
  'whatsapp',
  'email',
  'slack',
  'webhook',
  'discord',
  'teams',
];

const METRICS: Array<{ value: AlertMetric; label: string }> = [
  { value: 'status_down', label: 'Monitor down' },
  { value: 'status_up', label: 'Monitor recovered' },
  { value: 'latency_ms', label: 'Latency (ms)' },
  { value: 'http_status', label: 'HTTP status' },
  { value: 'ssl_days_remaining', label: 'SSL days remaining' },
];

const OPERATORS: AlertOperator[] = ['>', '>=', '<', '<=', '==', '!='];

export const AlertsPage: React.FC = () => {
  const [tab, setTab] = useState<'rules' | 'channels' | 'deliveries'>('rules');
  const [channels, setChannels] = useState<AlertChannel[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [deliveries, setDeliveries] = useState<AlertDelivery[]>([]);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [showRuleForm, setShowRuleForm] = useState(false);

  const [channelForm, setChannelForm] = useState({
    name: '',
    kind: 'telegram' as AlertChannelKind,
    bot_token: '',
    chat_id: '',
    phone: '',
    api_key: '',
    to: '',
    url: '',
  });

  const [ruleForm, setRuleForm] = useState({
    name: '',
    metric: 'status_down' as AlertMetric,
    operator: '==' as AlertOperator,
    threshold: '500',
    for_seconds: '0',
    cooldown_seconds: '900',
    monitor_id: '',
    channel_ids: [] as string[],
  });

  const load = useCallback(async () => {
    try {
      const [ch, rl, dl, mons] = await Promise.all([
        getAlertChannels(),
        getAlertRules(),
        getAlertDeliveries(),
        getMonitors(),
      ]);
      setChannels(ch);
      setRules(rl);
      setDeliveries(dl);
      setMonitors(mons);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar alertas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useLiveData(() => load(), !loading);

  async function handleCreateChannel(e: React.FormEvent) {
    e.preventDefault();
    const config: Record<string, unknown> = {};
    if (channelForm.kind === 'telegram') {
      config.bot_token = channelForm.bot_token;
      config.chat_id = channelForm.chat_id;
    } else if (channelForm.kind === 'whatsapp') {
      config.phone = channelForm.phone;
      config.api_key = channelForm.api_key;
    } else if (channelForm.kind === 'email') {
      config.to = channelForm.to;
    } else {
      config.url = channelForm.url;
    }

    try {
      await createAlertChannel({
        name: channelForm.name,
        kind: channelForm.kind,
        config,
      });
      setShowChannelForm(false);
      setChannelForm({
        name: '',
        kind: 'telegram',
        bot_token: '',
        chat_id: '',
        phone: '',
        api_key: '',
        to: '',
        url: '',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar canal');
    }
  }

  async function handleCreateRule(e: React.FormEvent) {
    e.preventDefault();
    if (ruleForm.channel_ids.length === 0) {
      setError('Selecione ao menos um canal');
      return;
    }
    try {
      await createAlertRule({
        name: ruleForm.name,
        metric: ruleForm.metric,
        operator: ruleForm.operator,
        threshold:
          ruleForm.metric === 'status_down' || ruleForm.metric === 'status_up'
            ? null
            : Number(ruleForm.threshold),
        for_seconds: Number(ruleForm.for_seconds) || 0,
        cooldown_seconds: Number(ruleForm.cooldown_seconds) || 900,
        monitor_id: ruleForm.monitor_id || null,
        channels: ruleForm.channel_ids.map((id, index) => ({
          channel_id: id,
          escalation_step: index,
          delay_seconds: index === 0 ? 0 : 300 * index,
        })),
      });
      setShowRuleForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar regra');
    }
  }

  function toggleChannel(id: string) {
    setRuleForm((f) => ({
      ...f,
      channel_ids: f.channel_ids.includes(id)
        ? f.channel_ids.filter((x) => x !== id)
        : [...f.channel_ids, id],
    }));
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Alert Engine</h1>
          <p className="page-subtitle">
            Regras, canais, cooldown, retry e escalonamento
          </p>
        </div>
        <div className="page-header__actions">
          {tab === 'channels' && (
            <button className="btn btn-primary" onClick={() => setShowChannelForm(true)}>
              <Plus size={14} /> Canal
            </button>
          )}
          {tab === 'rules' && (
            <button className="btn btn-primary" onClick={() => setShowRuleForm(true)}>
              <Plus size={14} /> Regra
            </button>
          )}
        </div>
      </div>

      <div className="filter-tabs">
        {(
          [
            { id: 'rules', label: 'Regras' },
            { id: 'channels', label: 'Canais' },
            { id: 'deliveries', label: 'Entregas' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            className={`btn ${tab === t.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div className="skeleton" style={{ height: 160, borderRadius: 14 }} />
      ) : tab === 'channels' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {channels.length === 0 && (
            <div className="glass" style={{ padding: 32, textAlign: 'center' }}>
              <Bell size={24} style={{ marginBottom: 8 }} />
              <p style={{ color: 'var(--text-muted)' }}>Nenhum canal ainda. Crie Telegram, Slack, Webhook…</p>
            </div>
          )}
          {channels.map((ch) => (
            <div key={ch.id} className="glass channel-row" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{ch.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {ch.kind} · {ch.is_enabled ? 'ativo' : 'pausado'}
                </div>
              </div>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  await deleteAlertChannel(ch.id);
                  await load();
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : tab === 'rules' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rules.length === 0 && (
            <div className="glass" style={{ padding: 32, textAlign: 'center' }}>
              <Zap size={24} style={{ marginBottom: 8 }} />
              <p style={{ color: 'var(--text-muted)' }}>
                Ex.: IF latency &gt; 500ms FOR 5 min THEN Telegram + Slack
              </p>
            </div>
          )}
          {rules.map((rule) => (
            <div key={rule.id} className="glass" style={{ padding: 16 }}>
              <div className="rule-row" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4, wordBreak: 'break-word' }}>{rule.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                    IF <code>{rule.metric}</code> {rule.operator}{' '}
                    {rule.threshold ?? '—'}
                    {rule.for_seconds > 0 ? ` FOR ${Math.round(rule.for_seconds / 60)} min` : ''}
                    {' '}THEN {rule.channels.map((c) => c.channel?.name || c.channel_id.slice(0, 6)).join(' + ')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                    cooldown {rule.cooldown_seconds}s · retry {rule.max_retries} ·{' '}
                    {rule.is_enabled ? 'ativa' : 'pausada'}
                    {rule.monitor_id
                      ? ` · monitor ${monitors.find((m) => m.id === rule.monitor_id)?.name || rule.monitor_id.slice(0, 8)}`
                      : ' · todos os monitores'}
                  </div>
                </div>
                <button
                  className="btn btn-danger"
                  onClick={async () => {
                    await deleteAlertRule(rule.id);
                    await load();
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {deliveries.length === 0 && (
            <div className="glass" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              Nenhuma entrega ainda.
            </div>
          )}
          {deliveries.map((d) => (
            <div key={d.id} className="glass" style={{ padding: 14, fontSize: 13 }}>
              <span className={`badge ${d.status === 'sent' ? 'badge-up' : d.status === 'failed' ? 'badge-down' : 'badge-unknown'}`}>
                {d.status}
              </span>{' '}
              attempt {d.attempt} · step {d.escalation_step} ·{' '}
              {new Date(d.created_at).toLocaleString('pt-BR')}
              {d.last_error ? ` · ${d.last_error}` : ''}
            </div>
          ))}
        </div>
      )}

      {showChannelForm && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowChannelForm(false)}>
          <div className="modal">
            <h2 className="modal__title">Novo canal</h2>
            <form onSubmit={handleCreateChannel} className="modal__form">
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input className="input" value={channelForm.name} onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="input" value={channelForm.kind} onChange={(e) => setChannelForm({ ...channelForm, kind: e.target.value as AlertChannelKind })}>
                  {CHANNEL_KINDS.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
              {channelForm.kind === 'telegram' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Bot token</label>
                    <input className="input" value={channelForm.bot_token} onChange={(e) => setChannelForm({ ...channelForm, bot_token: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Chat ID</label>
                    <input className="input" value={channelForm.chat_id} onChange={(e) => setChannelForm({ ...channelForm, chat_id: e.target.value })} required />
                  </div>
                </>
              )}
              {channelForm.kind === 'whatsapp' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="input" value={channelForm.phone} onChange={(e) => setChannelForm({ ...channelForm, phone: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">API key</label>
                    <input className="input" value={channelForm.api_key} onChange={(e) => setChannelForm({ ...channelForm, api_key: e.target.value })} required />
                  </div>
                </>
              )}
              {channelForm.kind === 'email' && (
                <div className="form-group">
                  <label className="form-label">To</label>
                  <input className="input" type="email" value={channelForm.to} onChange={(e) => setChannelForm({ ...channelForm, to: e.target.value })} required />
                </div>
              )}
              {['webhook', 'slack', 'discord', 'teams'].includes(channelForm.kind) && (
                <div className="form-group">
                  <label className="form-label">Webhook URL</label>
                  <input className="input" value={channelForm.url} onChange={(e) => setChannelForm({ ...channelForm, url: e.target.value })} required />
                </div>
              )}
              <div className="modal__actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowChannelForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Criar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRuleForm && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowRuleForm(false)}>
          <div className="modal" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className="modal__title">Nova regra</h2>
            <form onSubmit={handleCreateRule} className="modal__form">
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input className="input" value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Monitor (opcional)</label>
                <select className="input" value={ruleForm.monitor_id} onChange={(e) => setRuleForm({ ...ruleForm, monitor_id: e.target.value })}>
                  <option value="">Todos</option>
                  {monitors.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="modal-form-grid">
                <div className="form-group">
                  <label className="form-label">Métrica</label>
                  <select className="input" value={ruleForm.metric} onChange={(e) => setRuleForm({ ...ruleForm, metric: e.target.value as AlertMetric })}>
                    {METRICS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Operador</label>
                  <select className="input" value={ruleForm.operator} onChange={(e) => setRuleForm({ ...ruleForm, operator: e.target.value as AlertOperator })}>
                    {OPERATORS.map((op) => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                </div>
              </div>
              {(ruleForm.metric === 'latency_ms' || ruleForm.metric === 'http_status') && (
                <div className="form-group">
                  <label className="form-label">Threshold</label>
                  <input className="input" type="number" value={ruleForm.threshold} onChange={(e) => setRuleForm({ ...ruleForm, threshold: e.target.value })} />
                </div>
              )}
              <div className="modal-form-grid">
                <div className="form-group">
                  <label className="form-label">FOR (segundos)</label>
                  <input className="input" type="number" min={0} value={ruleForm.for_seconds} onChange={(e) => setRuleForm({ ...ruleForm, for_seconds: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Cooldown (segundos)</label>
                  <input className="input" type="number" min={0} value={ruleForm.cooldown_seconds} onChange={(e) => setRuleForm({ ...ruleForm, cooldown_seconds: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Canais (ordem = escalonamento)</label>
                {channels.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Crie um canal primeiro.</p>
                ) : (
                  channels.map((ch) => (
                    <label key={ch.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, fontSize: 14 }}>
                      <input
                        type="checkbox"
                        checked={ruleForm.channel_ids.includes(ch.id)}
                        onChange={() => toggleChannel(ch.id)}
                      />
                      {ch.name} ({ch.kind})
                    </label>
                  ))
                )}
              </div>
              <div className="modal__actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowRuleForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Criar regra</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
