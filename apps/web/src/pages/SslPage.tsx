import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Lock,
} from 'lucide-react';
import { getSslOverview } from '../services/api';
import type { SslHealthStatus, SslOverview } from '../types';
import { SmartStatCard } from '../components/dashboard/SmartStatCard';

function healthLabel(h: SslHealthStatus): string {
  switch (h) {
    case 'ok':
      return 'OK';
    case 'warning':
      return 'Atenção';
    case 'critical':
      return 'Crítico';
    case 'expired':
      return 'Expirado';
    default:
      return 'Desconhecido';
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export const SslPage: React.FC = () => {
  const [data, setData] = useState<SslOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      setData(await getSslOverview());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar SSL');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const s = data?.summary;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-header__title-row">
            <h1>SSL / TLS</h1>
          </div>
          <p className="page-header__desc">
            Validade, issuer, cipher, versão TLS e renovação dos certificados.
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

      {loading || !data || !s ? (
        <div className="glass world-map-skeleton" />
      ) : (
        <>
          <section className="dash-kpi-grid analytics-kpi">
            <SmartStatCard
              label="Certificados"
              value={String(s.total)}
              hint="Monitores tipo SSL"
              icon={<Lock size={15} />}
            />
            <SmartStatCard
              label="OK"
              value={String(s.ok)}
              tone="good"
              icon={<ShieldCheck size={15} />}
            />
            <SmartStatCard
              label="Atenção"
              value={String(s.warning)}
              tone={s.warning > 0 ? 'warn' : 'default'}
              hint="Dentro do limiar de aviso"
              icon={<Shield size={15} />}
            />
            <SmartStatCard
              label="Crítico"
              value={String(s.critical)}
              tone={s.critical > 0 ? 'bad' : 'default'}
              hint="≤ 7 dias"
              icon={<ShieldAlert size={15} />}
            />
            <SmartStatCard
              label="Expirados"
              value={String(s.expired)}
              tone={s.expired > 0 ? 'bad' : 'default'}
              icon={<ShieldX size={15} />}
            />
          </section>

          <section className="glass dash-panel">
            <div className="dash-panel__head">
              <h2>Certificados</h2>
              <p>Ordenados por dias restantes</p>
            </div>
            {data.certificates.length === 0 ? (
              <div className="dash-empty">
                Nenhum monitor SSL. Crie um monitor com tipo SSL / TLS.
              </div>
            ) : (
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Monitor</th>
                      <th>Saúde</th>
                      <th>Dias</th>
                      <th>Validade</th>
                      <th>Issuer</th>
                      <th>TLS</th>
                      <th>Cipher</th>
                      <th>Latência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.certificates.map((c) => (
                      <tr key={c.monitor_id}>
                        <td>
                          <Link to={`/monitors/${c.monitor_id}`}>{c.name}</Link>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {c.host || '—'}
                            {c.port ? `:${c.port}` : ''}
                          </div>
                        </td>
                        <td>
                          <span className={`ssl-health ssl-health--${c.health}`}>
                            {healthLabel(c.health)}
                          </span>
                        </td>
                        <td>
                          {c.days_remaining != null ? c.days_remaining : '—'}
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            aviso ≤ {c.warn_days}d
                          </div>
                        </td>
                        <td>{formatDate(c.valid_to)}</td>
                        <td
                          style={{
                            maxWidth: 220,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={c.issuer || undefined}
                        >
                          {c.issuer || '—'}
                        </td>
                        <td>{c.protocol || '—'}</td>
                        <td
                          style={{
                            maxWidth: 160,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={c.cipher || undefined}
                        >
                          {c.cipher || '—'}
                        </td>
                        <td>
                          {c.last_response_time_ms != null
                            ? `${c.last_response_time_ms} ms`
                            : '—'}
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
