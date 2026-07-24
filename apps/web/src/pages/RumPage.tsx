import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  RefreshCw,
  Eye,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Gauge,
} from 'lucide-react';
import {
  createRumSite,
  deleteRumSite,
  getRumOverview,
} from '../services/api';
import type { RumOverview, RumSite } from '../types';
import { SmartStatCard } from '../components/dashboard/SmartStatCard';
import { LiveIndicator } from '../components/LiveIndicator';
import { useLiveData } from '../hooks/useLiveData';

function formatVital(name: string, value: number | null): string {
  if (value == null) return '—';
  if (name === 'CLS') return value.toFixed(3);
  if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
  return `${Math.round(value)} ms`;
}

export const RumPage: React.FC = () => {
  const [data, setData] = useState<RumOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [origin, setOrigin] = useState('');
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      setData(await getRumOverview());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar RUM');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { status: liveStatus } = useLiveData(() => load(true), !loading);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const created = await createRumSite(
        name.trim(),
        origin.trim() || undefined
      );
      setNewToken(created.token);
      setName('');
      setOrigin('');
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar site');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(site: RumSite) {
    if (!confirm(`Remover site RUM "${site.name}"? Eventos serão apagados.`)) {
      return;
    }
    try {
      await deleteRumSite(site.id);
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
    <div className="page page--wide">
      <div className="page-header">
        <div>
          <div className="page-header__title-row">
            <h1>RUM</h1>
            {!loading && <LiveIndicator status={liveStatus} />}
          </div>
          <p className="page-header__desc">
            Real User Monitoring: Web Vitals, page views e erros do browser dos
            usuários finais.
          </p>
        </div>
        <div className="page-header__actions">
          <button
            className="btn btn-ghost"
            onClick={() => load()}
            disabled={refreshing}
          >
            <RefreshCw
              size={14}
              style={{
                animation: refreshing ? 'spin 1s linear infinite' : 'none',
              }}
            />
            Atualizar
          </button>
        </div>
      </div>

      {error && (
        <div
          className="glass-sm"
          style={{ padding: 12, marginBottom: 16, color: 'var(--red)' }}
        >
          {error}
        </div>
      )}

      {newToken && (
        <div className="glass dash-panel" style={{ marginBottom: 16, padding: 16 }}>
          <strong>Token do site (copie agora — não será mostrado de novo)</strong>
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 10,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <code style={{ wordBreak: 'break-all', flex: 1 }}>{newToken}</code>
            <button type="button" className="btn btn-ghost" onClick={copyToken}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setNewToken(null)}
            >
              Fechar
            </button>
          </div>
          <pre
            style={{
              marginTop: 12,
              fontSize: 12,
              overflow: 'auto',
              background: 'var(--bg-elevated, transparent)',
              padding: 12,
              borderRadius: 8,
            }}
          >{`import { init } from '@analytic-pulse/rum';

init({
  endpoint: '${import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'https://sua-api'}',
  token: '${newToken}',
});`}</pre>
        </div>
      )}

      <div
        className="smart-stat-grid"
        style={{ marginBottom: 20, opacity: loading ? 0.6 : 1 }}
      >
        <SmartStatCard
          label="Sites"
          value={String(s?.sites ?? 0)}
          icon={<Eye size={18} />}
        />
        <SmartStatCard
          label="Page views (24h)"
          value={String(s?.page_views_24h ?? 0)}
          icon={<Gauge size={18} />}
        />
        <SmartStatCard
          label="Sessões (24h)"
          value={String(s?.sessions_24h ?? 0)}
          icon={<Eye size={18} />}
        />
        <SmartStatCard
          label="Erros (24h)"
          value={String(s?.errors_24h ?? 0)}
          icon={<AlertTriangle size={18} />}
          hint={
            (s?.errors_24h ?? 0) > 0 ? 'Há erros recentes no browser' : undefined
          }
        />
      </div>

      <div className="glass dash-panel" style={{ marginBottom: 20 }}>
        <div className="dash-panel__head">
          <h2>Novo site</h2>
          <p>Gera token <code>ap_rum_…</code> para o SDK</p>
        </div>
        <form
          onSubmit={handleCreate}
          style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '0 4px 4px' }}
        >
          <input
            className="input"
            placeholder="Nome (ex.: Landing)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ minWidth: 180, flex: 1 }}
          />
          <input
            className="input"
            placeholder="Origem opcional (https://app.exemplo.com)"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            style={{ minWidth: 240, flex: 2 }}
          />
          <button className="btn btn-primary" type="submit" disabled={creating}>
            <Plus size={14} />
            Criar
          </button>
        </form>
      </div>

      <div className="glass dash-panel" style={{ marginBottom: 20 }}>
        <div className="dash-panel__head">
          <h2>Sites</h2>
          <p>Tokens de ingestão RUM</p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Prefixo</th>
                <th>Origem</th>
                <th>Eventos 24h</th>
                <th>Último evento</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data?.sites || []).length === 0 && (
                <tr>
                  <td colSpan={6} style={{ color: 'var(--text-muted)' }}>
                    Nenhum site ainda. Crie um acima e instale{' '}
                    <code>@analytic-pulse/rum</code>.
                  </td>
                </tr>
              )}
              {(data?.sites || []).map((site) => (
                <tr key={site.id}>
                  <td style={{ fontWeight: 600 }}>{site.name}</td>
                  <td>
                    <code>{site.token_prefix}…</code>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {site.origin_allow || 'qualquer'}
                  </td>
                  <td>{site.events_24h ?? 0}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {site.last_seen_at
                      ? new Date(site.last_seen_at).toLocaleString()
                      : '—'}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => handleDelete(site)}
                      aria-label="Remover"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass dash-panel" style={{ marginBottom: 20 }}>
        <div className="dash-panel__head">
          <h2>Web Vitals (7 dias)</h2>
          <p>P50 / P75 / P95 por métrica</p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Métrica</th>
                <th>N</th>
                <th>Média</th>
                <th>P50</th>
                <th>P75</th>
                <th>P95</th>
              </tr>
            </thead>
            <tbody>
              {(data?.vitals || []).length === 0 && (
                <tr>
                  <td colSpan={6} style={{ color: 'var(--text-muted)' }}>
                    Sem vitals ainda.
                  </td>
                </tr>
              )}
              {(data?.vitals || []).map((v) => (
                <tr key={v.name}>
                  <td style={{ fontWeight: 600 }}>{v.name}</td>
                  <td>{v.count}</td>
                  <td>{formatVital(v.name, v.avg)}</td>
                  <td>{formatVital(v.name, v.p50)}</td>
                  <td>{formatVital(v.name, v.p75)}</td>
                  <td>{formatVital(v.name, v.p95)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass dash-panel">
        <div className="dash-panel__head">
          <h2>Erros recentes</h2>
          <p>Últimos erros capturados no browser</p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Mensagem</th>
                <th>Path</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recent_errors || []).length === 0 && (
                <tr>
                  <td colSpan={3} style={{ color: 'var(--text-muted)' }}>
                    Nenhum erro recente.
                  </td>
                </tr>
              )}
              {(data?.recent_errors || []).map((ev) => (
                <tr key={ev.id}>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(ev.created_at).toLocaleString()}
                  </td>
                  <td style={{ wordBreak: 'break-word' }}>{ev.name || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {ev.path || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
