import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  RefreshCw,
  KeyRound,
  Trash2,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import {
  createApiKey,
  deleteApiKey,
  getApiKeys,
  getApiDocsUrl,
} from '../services/api';
import type { ApiKey, ApiKeysOverview } from '../types';
import { SmartStatCard } from '../components/dashboard/SmartStatCard';
import { usePolling, POLL_INTERVAL_MS } from '../hooks/usePolling';

export const ApiKeysPage: React.FC = () => {
  const [data, setData] = useState<ApiKeysOverview | null>(null);
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
      setData(await getApiKeys());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar API keys');
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
      const created = await createApiKey(name.trim());
      setNewToken(created.token);
      setName('');
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar chave');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(key: ApiKey) {
    if (!confirm(`Revogar chave "${key.name}"?`)) return;
    try {
      await deleteApiKey(key.id);
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao revogar');
    }
  }

  async function copyToken() {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const active = data?.keys.filter((k) => !k.revoked_at).length ?? 0;
  const docsUrl = getApiDocsUrl();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-header__title-row">
            <h1>API Keys</h1>
          </div>
          <p className="page-header__desc">
            Chaves <code>ap_pk_…</code> para a API pública versionada{' '}
            <code>/api/v1</code>.
          </p>
        </div>
        <div className="page-header__actions">
          <a
            className="btn btn-ghost"
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={14} />
            OpenAPI / Docs
          </a>
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
        <div
          className="glass dash-panel"
          style={{ marginBottom: 16, borderColor: 'rgba(34,197,94,0.35)' }}
        >
          <div className="dash-panel__head">
            <h2>Token da API</h2>
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
            Exemplo:{' '}
            <code>
              curl -H &quot;Authorization: Bearer ap_pk_…&quot;{' '}
              {docsUrl.replace(/\/docs$/, '/v1/monitors')}
            </code>
          </p>
        </div>
      )}

      <section className="glass dash-panel" style={{ marginBottom: 16 }}>
        <div className="dash-panel__head">
          <h2>Nova chave</h2>
          <p>Scopes padrão: read + write</p>
        </div>
        <form onSubmit={handleCreate} className="dns-scan-form">
          <input
            className="input"
            placeholder="Nome (ex: ci-prod, sdk-local)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={creating || !name.trim()}>
            <Plus size={14} /> Criar
          </button>
        </form>
      </section>

      {loading || !data ? (
        <div className="glass world-map-skeleton" />
      ) : (
        <>
          <section className="dash-kpi-grid analytics-kpi">
            <SmartStatCard
              label="Chaves"
              value={String(data.keys.length)}
              icon={<KeyRound size={15} />}
            />
            <SmartStatCard label="Ativas" value={String(active)} tone="good" />
            <SmartStatCard
              label="Revogadas"
              value={String(data.keys.length - active)}
              tone={data.keys.length - active > 0 ? 'warn' : 'default'}
            />
          </section>

          <section className="glass dash-panel">
            <div className="dash-panel__head">
              <h2>Chaves</h2>
              <p>Prefixo e último uso</p>
            </div>
            {data.keys.length === 0 ? (
              <div className="dash-empty">Nenhuma chave ainda.</div>
            ) : (
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Prefixo</th>
                      <th>Scopes</th>
                      <th>Status</th>
                      <th>Último uso</th>
                      <th>Criada</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.keys.map((k) => (
                      <tr key={k.id}>
                        <td>{k.name}</td>
                        <td>
                          <code style={{ fontSize: 12 }}>{k.token_prefix}…</code>
                        </td>
                        <td style={{ fontSize: 12 }}>{k.scopes.join(', ')}</td>
                        <td>
                          <span
                            className={`ssl-health ssl-health--${
                              k.revoked_at ? 'critical' : 'ok'
                            }`}
                          >
                            {k.revoked_at ? 'revoked' : 'active'}
                          </span>
                        </td>
                        <td>
                          {k.last_used_at
                            ? new Date(k.last_used_at).toLocaleString('pt-BR')
                            : '—'}
                        </td>
                        <td>
                          {new Date(k.created_at).toLocaleString('pt-BR')}
                        </td>
                        <td>
                          {!k.revoked_at && (
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => handleRevoke(k)}
                              aria-label="Revogar"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
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
