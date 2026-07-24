import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw, Server, Trash2, Copy, Check } from 'lucide-react';
import {
  createAgent,
  deleteAgent,
  getAgentsOverview,
} from '../services/api';
import type { Agent, AgentsOverview } from '../types';
import { SmartStatCard } from '../components/dashboard/SmartStatCard';
import { usePolling, POLL_INTERVAL_MS } from '../hooks/usePolling';

function formatPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${Number(n).toFixed(1)}%`;
}

export const AgentsPage: React.FC = () => {
  const [data, setData] = useState<AgentsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      setData(await getAgentsOverview());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar agents');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  usePolling(() => load(true), POLL_INTERVAL_MS, !loading);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const created = await createAgent(name.trim());
      setNewToken(created.token);
      setName('');
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar agent');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(agent: Agent) {
    if (!confirm(`Remover agent "${agent.name}"?`)) return;
    try {
      await deleteAgent(agent.id);
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover');
    }
  }

  async function copyToken() {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const s = data?.summary;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-header__title-row">
            <h1>Linux Agents</h1>
          </div>
          <p className="page-header__desc">
            CPU, RAM, swap, disco, temperatura, rede, containers, serviços e logs.
          </p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn-ghost" onClick={() => load()} disabled={refreshing}>
            <RefreshCw
              size={14}
              style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}
            />
            Atualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-sm" style={{ padding: 12, marginBottom: 16, color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {newToken && (
        <div className="glass dash-panel" style={{ marginBottom: 16, borderColor: 'rgba(34,197,94,0.35)' }}>
          <div className="dash-panel__head">
            <h2>Token do agent</h2>
            <p>Copie agora — não será exibido novamente</p>
          </div>
          <div className="dns-scan-form">
            <code className="input" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              {newToken}
            </code>
            <button type="button" className="btn btn-primary" onClick={copyToken}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setNewToken(null)}>
              Fechar
            </button>
          </div>
          <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            No servidor: <code>PULSE_API_URL</code> + <code>PULSE_AGENT_TOKEN</code> →{' '}
            <code>npm start</code> em <code>apps/agent</code>
          </p>
        </div>
      )}

      <section className="glass dash-panel" style={{ marginBottom: 16 }}>
        <div className="dash-panel__head">
          <h2>Novo agent</h2>
          <p>Gera um token de ingestão</p>
        </div>
        <form onSubmit={handleCreate} className="dns-scan-form">
          <input
            className="input"
            placeholder="Nome (ex: prod-web-01)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={creating || !name.trim()}>
            <Plus size={14} /> Criar
          </button>
        </form>
      </section>

      {loading || !data || !s ? (
        <div className="glass world-map-skeleton" />
      ) : (
        <>
          <section className="dash-kpi-grid analytics-kpi">
            <SmartStatCard label="Total" value={String(s.total)} icon={<Server size={15} />} />
            <SmartStatCard
              label="Online"
              value={String(s.online)}
              tone="good"
            />
            <SmartStatCard
              label="Offline"
              value={String(s.offline)}
              tone={s.offline > 0 ? 'bad' : 'default'}
            />
            <SmartStatCard label="Pendentes" value={String(s.pending)} />
          </section>

          <section className="glass dash-panel">
            <div className="dash-panel__head">
              <h2>Hosts</h2>
              <p>Último heartbeat e uso de recursos</p>
            </div>
            {data.agents.length === 0 ? (
              <div className="dash-empty">Nenhum agent ainda. Crie um e instale o collector.</div>
            ) : (
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Status</th>
                      <th>CPU</th>
                      <th>RAM</th>
                      <th>Disco</th>
                      <th>Temp</th>
                      <th>Visto</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.agents.map((a) => {
                      const m = a.latest_metrics;
                      const diskMax =
                        m.disks && m.disks.length
                          ? Math.max(...m.disks.map((d) => d.usage_pct))
                          : null;
                      return (
                        <tr key={a.id}>
                          <td>
                            <Link to={`/agents/${a.id}`}>{a.name}</Link>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {a.hostname || a.token_prefix + '…'}
                            </div>
                          </td>
                          <td>
                            <span className={`ssl-health ssl-health--${a.status === 'online' ? 'ok' : a.status === 'offline' ? 'critical' : 'warning'}`}>
                              {a.status}
                            </span>
                          </td>
                          <td>{formatPct(m.cpu?.usage_pct)}</td>
                          <td>{formatPct(m.memory?.usage_pct)}</td>
                          <td>{formatPct(diskMax)}</td>
                          <td>
                            {m.temperature_c != null ? `${m.temperature_c}°C` : '—'}
                          </td>
                          <td>
                            {a.last_seen_at
                              ? new Date(a.last_seen_at).toLocaleString('pt-BR')
                              : '—'}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => handleDelete(a)}
                              aria-label="Remover"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
