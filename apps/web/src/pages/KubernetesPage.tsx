import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw,
  Ship,
  Box,
  Layers,
  Network,
  Globe2,
  HardDrive,
  Server,
} from 'lucide-react';
import { getKubernetesOverview } from '../services/api';
import type { KubernetesOverview } from '../types';
import { SmartStatCard } from '../components/dashboard/SmartStatCard';

type Tab =
  | 'pods'
  | 'deployments'
  | 'services'
  | 'ingress'
  | 'nodes'
  | 'namespaces'
  | 'pvc';

function podTone(status: string): 'ok' | 'warning' | 'critical' {
  const s = status.toLowerCase();
  if (s === 'running' || s === 'succeeded') return 'ok';
  if (s === 'pending' || s === 'unknown') return 'warning';
  return 'critical';
}

export const KubernetesPage: React.FC = () => {
  const [data, setData] = useState<KubernetesOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('pods');
  const [hostFilter, setHostFilter] = useState('all');
  const [nsFilter, setNsFilter] = useState('all');

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      setData(await getKubernetesOverview());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar Kubernetes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 20000);
    return () => clearInterval(t);
  }, [load]);

  const namespaces = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    for (const p of data.pods) set.add(p.namespace);
    for (const d of data.deployments) set.add(d.namespace);
    for (const s of data.services) set.add(s.namespace);
    return Array.from(set).sort();
  }, [data]);

  function byHostAndNs<T extends { agent_id: string; namespace?: string }>(
    rows: T[]
  ): T[] {
    return rows.filter((r) => {
      if (hostFilter !== 'all' && r.agent_id !== hostFilter) return false;
      if (nsFilter !== 'all' && r.namespace && r.namespace !== nsFilter) return false;
      return true;
    });
  }

  const s = data?.summary;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-header__title-row">
            <h1>Kubernetes</h1>
          </div>
          <p className="page-header__desc">
            Pods, Deployments, Services, Ingress, Nodes, Namespaces e PVC via agents.
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
              label="Clusters"
              value={String(s.hosts_with_k8s)}
              hint={`${s.hosts} agents`}
              icon={<Ship size={15} />}
            />
            <SmartStatCard
              label="Pods"
              value={String(s.pods_total)}
              hint={`${s.pods_running} running`}
              icon={<Box size={15} />}
              tone={s.pods_running > 0 ? 'good' : 'default'}
            />
            <SmartStatCard
              label="Deployments"
              value={String(s.deployments_total)}
              icon={<Layers size={15} />}
            />
            <SmartStatCard
              label="Services"
              value={String(s.services_total)}
              icon={<Network size={15} />}
            />
            <SmartStatCard
              label="Nodes"
              value={String(s.nodes_total)}
              icon={<Server size={15} />}
            />
            <SmartStatCard
              label="PVCs"
              value={String(s.pvcs_total)}
              icon={<HardDrive size={15} />}
            />
          </section>

          <section className="glass dash-panel" style={{ marginBottom: 16 }}>
            <div className="dash-panel__head">
              <h2>Hosts / contextos</h2>
              <p>Agents com kubectl acessível</p>
            </div>
            {data.hosts.length === 0 ? (
              <div className="dash-empty">
                Nenhum agent. Crie um em <Link to="/agents">Agents</Link> e instale o
                collector com acesso ao cluster.
              </div>
            ) : (
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Host</th>
                      <th>Status</th>
                      <th>K8s</th>
                      <th>Context</th>
                      <th>Pods</th>
                      <th>Deploys</th>
                      <th>Nodes</th>
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
                          <Link
                            to={`/agents/${h.agent_id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
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
                        <td style={{ fontSize: 12 }}>{h.context || '—'}</td>
                        <td>
                          {h.pods_running}/{h.pods_total}
                        </td>
                        <td>{h.deployments}</td>
                        <td>{h.nodes}</td>
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

            <div
              style={{
                marginTop: 12,
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Namespace
                <select
                  className="input"
                  style={{ marginLeft: 8, minWidth: 140 }}
                  value={nsFilter}
                  onChange={(e) => setNsFilter(e.target.value)}
                >
                  <option value="all">todos</option>
                  {namespaces.map((ns) => (
                    <option key={ns} value={ns}>
                      {ns}
                    </option>
                  ))}
                </select>
              </label>
              {(hostFilter !== 'all' || nsFilter !== 'all') && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setHostFilter('all');
                    setNsFilter('all');
                  }}
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </section>

          <div
            className="dns-tabs"
            style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}
          >
            {(
              [
                ['pods', 'Pods', <Box size={14} key="p" />],
                ['deployments', 'Deployments', <Layers size={14} key="d" />],
                ['services', 'Services', <Network size={14} key="s" />],
                ['ingress', 'Ingress', <Globe2 size={14} key="i" />],
                ['nodes', 'Nodes', <Server size={14} key="n" />],
                ['namespaces', 'Namespaces', <Ship size={14} key="ns" />],
                ['pvc', 'PVC', <HardDrive size={14} key="v" />],
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

          {tab === 'pods' && (
            <section className="glass dash-panel">
              <div className="dash-panel__head">
                <h2>Pods</h2>
              </div>
              {byHostAndNs(data.pods).length === 0 ? (
                <div className="dash-empty">Nenhum pod reportado.</div>
              ) : (
                <div className="analytics-table-wrap">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>NS</th>
                        <th>Host</th>
                        <th>Status</th>
                        <th>Ready</th>
                        <th>Restarts</th>
                        <th>Node</th>
                        <th>Age</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byHostAndNs(data.pods).map((p) => (
                        <tr key={`${p.agent_id}:${p.namespace}:${p.name}`}>
                          <td>
                            <code style={{ fontSize: 12 }}>{p.name}</code>
                          </td>
                          <td>{p.namespace}</td>
                          <td>
                            <Link to={`/agents/${p.agent_id}`}>{p.agent_name}</Link>
                          </td>
                          <td>
                            <span className={`ssl-health ssl-health--${podTone(p.status)}`}>
                              {p.status}
                            </span>
                          </td>
                          <td>{p.ready}</td>
                          <td>{p.restarts}</td>
                          <td style={{ fontSize: 12 }}>{p.node || '—'}</td>
                          <td>{p.age || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {tab === 'deployments' && (
            <section className="glass dash-panel">
              <div className="dash-panel__head">
                <h2>Deployments</h2>
              </div>
              {byHostAndNs(data.deployments).length === 0 ? (
                <div className="dash-empty">Nenhum deployment.</div>
              ) : (
                <div className="analytics-table-wrap">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>NS</th>
                        <th>Host</th>
                        <th>Ready</th>
                        <th>Up-to-date</th>
                        <th>Available</th>
                        <th>Age</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byHostAndNs(data.deployments).map((d) => (
                        <tr key={`${d.agent_id}:${d.namespace}:${d.name}`}>
                          <td>{d.name}</td>
                          <td>{d.namespace}</td>
                          <td>{d.agent_name}</td>
                          <td>{d.ready}</td>
                          <td>{d.up_to_date}</td>
                          <td>{d.available}</td>
                          <td>{d.age || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {tab === 'services' && (
            <section className="glass dash-panel">
              <div className="dash-panel__head">
                <h2>Services</h2>
              </div>
              {byHostAndNs(data.services).length === 0 ? (
                <div className="dash-empty">Nenhum service.</div>
              ) : (
                <div className="analytics-table-wrap">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>NS</th>
                        <th>Type</th>
                        <th>Cluster IP</th>
                        <th>External</th>
                        <th>Ports</th>
                        <th>Host</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byHostAndNs(data.services).map((svc) => (
                        <tr key={`${svc.agent_id}:${svc.namespace}:${svc.name}`}>
                          <td>{svc.name}</td>
                          <td>{svc.namespace}</td>
                          <td>{svc.type}</td>
                          <td style={{ fontSize: 12 }}>{svc.cluster_ip || '—'}</td>
                          <td style={{ fontSize: 12 }}>{svc.external_ip || '—'}</td>
                          <td style={{ fontSize: 11 }}>{svc.ports || '—'}</td>
                          <td>{svc.agent_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {tab === 'ingress' && (
            <section className="glass dash-panel">
              <div className="dash-panel__head">
                <h2>Ingress</h2>
              </div>
              {byHostAndNs(data.ingresses).length === 0 ? (
                <div className="dash-empty">Nenhum ingress.</div>
              ) : (
                <div className="analytics-table-wrap">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>NS</th>
                        <th>Class</th>
                        <th>Hosts</th>
                        <th>Address</th>
                        <th>Host</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byHostAndNs(data.ingresses).map((ing) => (
                        <tr key={`${ing.agent_id}:${ing.namespace}:${ing.name}`}>
                          <td>{ing.name}</td>
                          <td>{ing.namespace}</td>
                          <td>{ing.class || '—'}</td>
                          <td style={{ fontSize: 12 }}>{ing.hosts || '—'}</td>
                          <td style={{ fontSize: 12 }}>{ing.address || '—'}</td>
                          <td>{ing.agent_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {tab === 'nodes' && (
            <section className="glass dash-panel">
              <div className="dash-panel__head">
                <h2>Nodes</h2>
              </div>
              {data.nodes.filter(
                (n) => hostFilter === 'all' || n.agent_id === hostFilter
              ).length === 0 ? (
                <div className="dash-empty">Nenhum node.</div>
              ) : (
                <div className="analytics-table-wrap">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Status</th>
                        <th>Roles</th>
                        <th>Version</th>
                        <th>CPU</th>
                        <th>Memory</th>
                        <th>Age</th>
                        <th>Host</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.nodes
                        .filter(
                          (n) => hostFilter === 'all' || n.agent_id === hostFilter
                        )
                        .map((n) => (
                          <tr key={`${n.agent_id}:${n.name}`}>
                            <td>{n.name}</td>
                            <td>
                              <span
                                className={`ssl-health ssl-health--${
                                  n.status === 'Ready' ? 'ok' : 'critical'
                                }`}
                              >
                                {n.status}
                              </span>
                            </td>
                            <td>{n.roles || '—'}</td>
                            <td style={{ fontSize: 12 }}>{n.version || '—'}</td>
                            <td>{n.cpu || '—'}</td>
                            <td style={{ fontSize: 12 }}>{n.memory || '—'}</td>
                            <td>{n.age || '—'}</td>
                            <td>{n.agent_name}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {tab === 'namespaces' && (
            <section className="glass dash-panel">
              <div className="dash-panel__head">
                <h2>Namespaces</h2>
              </div>
              {data.namespaces.filter(
                (n) => hostFilter === 'all' || n.agent_id === hostFilter
              ).length === 0 ? (
                <div className="dash-empty">Nenhum namespace.</div>
              ) : (
                <div className="analytics-table-wrap">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Status</th>
                        <th>Age</th>
                        <th>Host</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.namespaces
                        .filter(
                          (n) => hostFilter === 'all' || n.agent_id === hostFilter
                        )
                        .map((n) => (
                          <tr key={`${n.agent_id}:${n.name}`}>
                            <td>{n.name}</td>
                            <td>{n.status}</td>
                            <td>{n.age || '—'}</td>
                            <td>{n.agent_name}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {tab === 'pvc' && (
            <section className="glass dash-panel">
              <div className="dash-panel__head">
                <h2>PersistentVolumeClaims</h2>
              </div>
              {byHostAndNs(data.pvcs).length === 0 ? (
                <div className="dash-empty">Nenhum PVC.</div>
              ) : (
                <div className="analytics-table-wrap">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>NS</th>
                        <th>Status</th>
                        <th>Capacity</th>
                        <th>StorageClass</th>
                        <th>Volume</th>
                        <th>Host</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byHostAndNs(data.pvcs).map((pvc) => (
                        <tr key={`${pvc.agent_id}:${pvc.namespace}:${pvc.name}`}>
                          <td>{pvc.name}</td>
                          <td>{pvc.namespace}</td>
                          <td>{pvc.status}</td>
                          <td>{pvc.capacity || '—'}</td>
                          <td>{pvc.storage_class || '—'}</td>
                          <td style={{ fontSize: 11 }}>{pvc.volume || '—'}</td>
                          <td>{pvc.agent_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
};
