import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw,
  Box,
  Container,
  HardDrive,
  Network,
  ScrollText,
} from 'lucide-react';
import { getDockerOverview } from '../services/api';
import type { DockerOverview } from '../types';
import { SmartStatCard } from '../components/dashboard/SmartStatCard';
import { usePolling, POLL_INTERVAL_MS } from '../hooks/usePolling';

function formatPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${Number(n).toFixed(1)}%`;
}

function formatBytes(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function isRunning(state?: string | null, status?: string): boolean {
  const s = `${state || ''} ${status || ''}`.toLowerCase();
  return s.includes('running');
}

type Tab = 'containers' | 'volumes' | 'networks' | 'logs';

export const DockerPage: React.FC = () => {
  const [data, setData] = useState<DockerOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('containers');
  const [hostFilter, setHostFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      setData(await getDockerOverview());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar Docker');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  usePolling(() => load(true), POLL_INTERVAL_MS, !loading);

  const filteredContainers = useMemo(() => {
    if (!data) return [];
    if (hostFilter === 'all') return data.containers;
    return data.containers.filter((c) => c.agent_id === hostFilter);
  }, [data, hostFilter]);

  const filteredVolumes = useMemo(() => {
    if (!data) return [];
    if (hostFilter === 'all') return data.volumes;
    return data.volumes.filter((v) => v.agent_id === hostFilter);
  }, [data, hostFilter]);

  const filteredNetworks = useMemo(() => {
    if (!data) return [];
    if (hostFilter === 'all') return data.networks;
    return data.networks.filter((n) => n.agent_id === hostFilter);
  }, [data, hostFilter]);

  const filteredLogs = useMemo(() => {
    if (!data) return [];
    if (hostFilter === 'all') return data.logs;
    return data.logs.filter((l) => l.agent_id === hostFilter);
  }, [data, hostFilter]);

  const activeLog = useMemo(() => {
    if (!filteredLogs.length) return null;
    const key = selectedLog || `${filteredLogs[0].agent_id}:${filteredLogs[0].container_id}`;
    return (
      filteredLogs.find((l) => `${l.agent_id}:${l.container_id}` === key) ||
      filteredLogs[0]
    );
  }, [filteredLogs, selectedLog]);

  const s = data?.summary;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-header__title-row">
            <h1>Docker</h1>
          </div>
          <p className="page-header__desc">
            Containers, CPU, RAM, restarts, volumes, networks e logs via agents.
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
              label="Hosts"
              value={String(s.hosts)}
              hint={`${s.hosts_with_docker} com Docker`}
              icon={<Box size={15} />}
            />
            <SmartStatCard
              label="Containers"
              value={String(s.containers_total)}
              hint={`${s.containers_running} running`}
              icon={<Container size={15} />}
              tone={s.containers_running > 0 ? 'good' : 'default'}
            />
            <SmartStatCard
              label="Volumes"
              value={String(s.volumes_total)}
              icon={<HardDrive size={15} />}
            />
            <SmartStatCard
              label="Networks"
              value={String(s.networks_total)}
              icon={<Network size={15} />}
            />
          </section>

          <section className="glass dash-panel" style={{ marginBottom: 16 }}>
            <div className="dash-panel__head">
              <h2>Hosts</h2>
              <p>Agents reportando Docker</p>
            </div>
            {data.hosts.length === 0 ? (
              <div className="dash-empty">
                Nenhum agent. Crie um em <Link to="/agents">Agents</Link> e atualize o collector.
              </div>
            ) : (
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Host</th>
                      <th>Status</th>
                      <th>Docker</th>
                      <th>Running</th>
                      <th>Stopped</th>
                      <th>Volumes</th>
                      <th>Networks</th>
                      <th>Visto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.hosts.map((h) => (
                      <tr
                        key={h.agent_id}
                        style={{
                          cursor: 'pointer',
                          background:
                            hostFilter === h.agent_id
                              ? 'rgba(129,140,248,0.08)'
                              : undefined,
                        }}
                        onClick={() =>
                          setHostFilter((prev) =>
                            prev === h.agent_id ? 'all' : h.agent_id
                          )
                        }
                      >
                        <td>
                          <Link to={`/agents/${h.agent_id}`} onClick={(e) => e.stopPropagation()}>
                            {h.agent_name}
                          </Link>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {h.hostname || '—'}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`ssl-health ssl-health--${
                              h.status === 'online'
                                ? 'ok'
                                : h.status === 'offline'
                                  ? 'critical'
                                  : 'warning'
                            }`}
                          >
                            {h.status}
                          </span>
                        </td>
                        <td>{h.available ? 'sim' : 'não'}</td>
                        <td>{h.containers_running}</td>
                        <td>{h.containers_stopped}</td>
                        <td>{h.volumes}</td>
                        <td>{h.networks}</td>
                        <td>
                          {h.last_seen_at
                            ? new Date(h.last_seen_at).toLocaleString('pt-BR')
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {hostFilter !== 'all' && (
              <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                Filtro ativo ·{' '}
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '2px 8px', fontSize: 12 }}
                  onClick={() => setHostFilter('all')}
                >
                  Limpar
                </button>
              </p>
            )}
          </section>

          <div className="dns-tabs" style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(
              [
                ['containers', 'Containers', <Container size={14} key="c" />],
                ['volumes', 'Volumes', <HardDrive size={14} key="v" />],
                ['networks', 'Networks', <Network size={14} key="n" />],
                ['logs', 'Logs', <ScrollText size={14} key="l" />],
              ] as const
            ).map(([id, label, icon]) => (
              <button
                key={id}
                type="button"
                className={`btn ${tab === id ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setTab(id)}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          {tab === 'containers' && (
            <section className="glass dash-panel">
              <div className="dash-panel__head">
                <h2>Containers</h2>
                <p>CPU, memória, restarts e portas</p>
              </div>
              {filteredContainers.length === 0 ? (
                <div className="dash-empty">Nenhum container reportado.</div>
              ) : (
                <div className="analytics-table-wrap">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Host</th>
                        <th>Estado</th>
                        <th>CPU</th>
                        <th>RAM</th>
                        <th>Restarts</th>
                        <th>Portas</th>
                        <th>Imagem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContainers.map((c) => (
                        <tr key={`${c.agent_id}:${c.id}`}>
                          <td>
                            <code style={{ fontSize: 12 }}>{c.name}</code>
                          </td>
                          <td>
                            <Link to={`/agents/${c.agent_id}`}>{c.agent_name}</Link>
                          </td>
                          <td>
                            <span
                              className={`ssl-health ssl-health--${
                                isRunning(c.state, c.status) ? 'ok' : 'warning'
                              }`}
                            >
                              {c.state || c.status || '—'}
                            </span>
                          </td>
                          <td>{formatPct(c.cpu_pct)}</td>
                          <td>
                            {formatPct(c.mem_pct)}
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {formatBytes(c.mem_usage_bytes)}
                            </div>
                          </td>
                          <td>{c.restart_count ?? '—'}</td>
                          <td style={{ maxWidth: 160, fontSize: 11 }}>
                            {c.ports || '—'}
                          </td>
                          <td style={{ maxWidth: 180, fontSize: 11 }}>{c.image}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {tab === 'volumes' && (
            <section className="glass dash-panel">
              <div className="dash-panel__head">
                <h2>Volumes</h2>
              </div>
              {filteredVolumes.length === 0 ? (
                <div className="dash-empty">Nenhum volume.</div>
              ) : (
                <div className="analytics-table-wrap">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Host</th>
                        <th>Driver</th>
                        <th>Mountpoint</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVolumes.map((v) => (
                        <tr key={`${v.agent_id}:${v.name}`}>
                          <td>{v.name}</td>
                          <td>{v.agent_name}</td>
                          <td>{v.driver}</td>
                          <td style={{ fontSize: 11 }}>{v.mountpoint || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {tab === 'networks' && (
            <section className="glass dash-panel">
              <div className="dash-panel__head">
                <h2>Networks</h2>
              </div>
              {filteredNetworks.length === 0 ? (
                <div className="dash-empty">Nenhuma network.</div>
              ) : (
                <div className="analytics-table-wrap">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Host</th>
                        <th>Driver</th>
                        <th>Scope</th>
                        <th>ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredNetworks.map((n) => (
                        <tr key={`${n.agent_id}:${n.id}`}>
                          <td>{n.name}</td>
                          <td>{n.agent_name}</td>
                          <td>{n.driver}</td>
                          <td>{n.scope || '—'}</td>
                          <td>
                            <code style={{ fontSize: 11 }}>{n.id.slice(0, 12)}</code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {tab === 'logs' && (
            <section className="glass dash-panel">
              <div className="dash-panel__head">
                <h2>Logs</h2>
                <p>Últimas linhas por container (tail)</p>
              </div>
              {filteredLogs.length === 0 ? (
                <div className="dash-empty">Sem logs de containers.</div>
              ) : (
                <div className="dash-grid-2">
                  <div>
                    <ul className="dash-top-list">
                      {filteredLogs.map((l) => {
                        const key = `${l.agent_id}:${l.container_id}`;
                        const active =
                          activeLog &&
                          `${activeLog.agent_id}:${activeLog.container_id}` === key;
                        return (
                          <li key={key}>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              style={{
                                width: '100%',
                                justifyContent: 'flex-start',
                                background: active
                                  ? 'rgba(129,140,248,0.12)'
                                  : undefined,
                              }}
                              onClick={() => setSelectedLog(key)}
                            >
                              <div className="dash-top-list__main" style={{ textAlign: 'left' }}>
                                <div className="dash-top-list__name">{l.container}</div>
                                <div className="dash-top-list__meta">
                                  {l.agent_name} · {l.lines.length} linhas
                                </div>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div className="agent-logs">
                    {activeLog?.lines.map((line, i) => (
                      <div key={i} className="agent-logs__line">
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
};
