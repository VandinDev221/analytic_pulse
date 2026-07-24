import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw,
  Search,
  Server,
  CheckCircle,
  AlertTriangle,
  Globe2,
} from 'lucide-react';
import { getDnsOverview, scanDnsDomain } from '../services/api';
import type { DnsDomainScan, DnsOverview, DnsRecordType } from '../types';
import { SmartStatCard } from '../components/dashboard/SmartStatCard';
import { usePolling, POLL_INTERVAL_MS } from '../hooks/usePolling';

export const DnsPage: React.FC = () => {
  const [data, setData] = useState<DnsOverview | null>(null);
  const [scan, setScan] = useState<DnsDomainScan | null>(null);
  const [host, setHost] = useState('');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [scanError, setScanError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      setData(await getDnsOverview());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar DNS');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  usePolling(() => load(true), POLL_INTERVAL_MS, !loading);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    setScanning(true);
    setScanError('');
    try {
      setScan(await scanDnsDomain(host));
    } catch (err) {
      setScan(null);
      setScanError(err instanceof Error ? err.message : 'Falha no scan');
    } finally {
      setScanning(false);
    }
  }

  const s = data?.summary;
  const typeEntries = s
    ? (Object.entries(s.by_type) as Array<[DnsRecordType, number]>)
    : [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-header__title-row">
            <h1>DNS</h1>
          </div>
          <p className="page-header__desc">
            A, AAAA, MX, TXT, CNAME, NS, SPF, DKIM, DMARC e DNSSEC.
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
              label="Monitores DNS"
              value={String(s.total)}
              icon={<Server size={15} />}
            />
            <SmartStatCard
              label="Online"
              value={String(s.up)}
              tone="good"
              icon={<CheckCircle size={15} />}
            />
            <SmartStatCard
              label="Offline"
              value={String(s.down)}
              tone={s.down > 0 ? 'bad' : 'default'}
              icon={<AlertTriangle size={15} />}
            />
            <SmartStatCard
              label="Tipos cobertos"
              value={String(typeEntries.length)}
              hint={typeEntries.map(([t, n]) => `${t}:${n}`).join(' · ') || '—'}
              icon={<Globe2 size={15} />}
            />
          </section>

          <section className="glass dash-panel" style={{ marginBottom: 16 }}>
            <div className="dash-panel__head">
              <h2>Scan de domínio</h2>
              <p>Consulta todos os tipos de registro de uma vez</p>
            </div>
            <form onSubmit={handleScan} className="dns-scan-form">
              <input
                className="input"
                placeholder="exemplo.com"
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
              <button className="btn btn-primary" type="submit" disabled={scanning || !host.trim()}>
                <Search size={14} />
                {scanning ? 'Consultando…' : 'Scan'}
              </button>
            </form>
            {scanError && (
              <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{scanError}</div>
            )}
            {scan && (
              <div className="dns-scan-result">
                <div className="dns-auth-row">
                  {[
                    { key: 'SPF', ok: scan.email_auth.spf },
                    { key: 'DKIM', ok: scan.email_auth.dkim },
                    { key: 'DMARC', ok: scan.email_auth.dmarc },
                    { key: 'DNSSEC', ok: scan.email_auth.dnssec },
                  ].map((item) => (
                    <span
                      key={item.key}
                      className={`ssl-health ${item.ok ? 'ssl-health--ok' : 'ssl-health--critical'}`}
                    >
                      {item.key} {item.ok ? 'OK' : 'Ausente'}
                    </span>
                  ))}
                </div>
                <div className="analytics-table-wrap" style={{ marginTop: 14 }}>
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Status</th>
                        <th>Registros</th>
                        <th>Latência</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scan.results.map((r) => (
                        <tr key={r.type}>
                          <td>
                            <strong>{r.type}</strong>
                          </td>
                          <td>
                            <span
                              className={`ssl-health ${r.ok ? 'ssl-health--ok' : 'ssl-health--critical'}`}
                            >
                              {r.ok ? 'OK' : 'Falha'}
                            </span>
                          </td>
                          <td style={{ whiteSpace: 'normal', maxWidth: 420 }}>
                            {r.records.length
                              ? r.records
                                  .slice(0, 6)
                                  .map((a) =>
                                    a.priority != null ? `${a.priority} ${a.value}` : a.value
                                  )
                                  .join(' · ')
                              : r.error || '—'}
                          </td>
                          <td>{r.latency_ms} ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <section className="glass dash-panel">
            <div className="dash-panel__head">
              <h2>Monitores DNS</h2>
              <p>Última resolução persistida</p>
            </div>
            {data.monitors.length === 0 ? (
              <div className="dash-empty">
                Nenhum monitor DNS. Crie um monitor com tipo DNS.
              </div>
            ) : (
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Monitor</th>
                      <th>Tipo</th>
                      <th>Status</th>
                      <th>Qtd</th>
                      <th>Respostas</th>
                      <th>Latência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monitors.map((m) => (
                      <tr key={m.monitor_id}>
                        <td>
                          <Link to={`/monitors/${m.monitor_id}`}>{m.name}</Link>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {m.host || '—'}
                          </div>
                        </td>
                        <td>
                          <code>{m.record_type}</code>
                        </td>
                        <td>
                          <span className={`badge badge-${m.status}`}>{m.status}</span>
                        </td>
                        <td>{m.record_count ?? '—'}</td>
                        <td style={{ whiteSpace: 'normal', maxWidth: 360 }}>
                          {m.answers_preview ||
                            m.records
                              .slice(0, 3)
                              .map((r) => r.value)
                              .join(' · ') ||
                            '—'}
                        </td>
                        <td>
                          {m.last_response_time_ms != null
                            ? `${m.last_response_time_ms} ms`
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
