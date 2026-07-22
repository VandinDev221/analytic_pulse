import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Cpu,
  HardDrive,
  Thermometer,
  Database,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { getAgent } from '../services/api';
import type { AgentDetail } from '../types';
import { SmartStatCard } from '../components/dashboard/SmartStatCard';

export const AgentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setAgent(await getAgent(id));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  if (loading && !agent) return <div className="page"><div className="glass world-map-skeleton" /></div>;
  if (!agent) {
    return (
      <div className="page">
        <p style={{ color: 'var(--red)' }}>{error || 'Agent não encontrado'}</p>
        <Link to="/agents" className="btn btn-ghost"><ArrowLeft size={14} /> Voltar</Link>
      </div>
    );
  }

  const m = agent.latest_metrics;
  const chartData = agent.history.map((h) => ({
    ...h,
    label: new Date(h.collected_at).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  }));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/agents" className="btn btn-ghost" style={{ marginBottom: 8 }}>
            <ArrowLeft size={14} /> Agents
          </Link>
          <div className="page-header__title-row">
            <h1>{agent.name}</h1>
            <span className={`ssl-health ssl-health--${agent.status === 'online' ? 'ok' : 'critical'}`}>
              {agent.status}
            </span>
          </div>
          <p className="page-header__desc">
            {agent.hostname || '—'} · {agent.os_info.distro || agent.os_info.platform || 'Linux'} · v
            {agent.agent_version || '?'}
          </p>
        </div>
        <button className="btn btn-ghost" onClick={load}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {error && (
        <div className="glass-sm" style={{ padding: 12, marginBottom: 16, color: 'var(--red)' }}>
          {error}
        </div>
      )}

      <section className="dash-kpi-grid analytics-kpi">
        <SmartStatCard
          label="CPU"
          value={m.cpu ? `${m.cpu.usage_pct}%` : '—'}
          hint={m.cpu ? `load ${m.cpu.load_avg.join(' / ')}` : undefined}
          icon={<Cpu size={15} />}
        />
        <SmartStatCard
          label="RAM"
          value={m.memory ? `${m.memory.usage_pct}%` : '—'}
          icon={<Database size={15} />}
        />
        <SmartStatCard
          label="Swap"
          value={m.swap ? `${m.swap.usage_pct}%` : '—'}
        />
        <SmartStatCard
          label="Disco max"
          value={
            m.disks?.length
              ? `${Math.max(...m.disks.map((d) => d.usage_pct)).toFixed(1)}%`
              : '—'
          }
          icon={<HardDrive size={15} />}
        />
        <SmartStatCard
          label="Temperatura"
          value={m.temperature_c != null ? `${m.temperature_c}°C` : '—'}
          icon={<Thermometer size={15} />}
        />
      </section>

      <section className="glass dash-panel" style={{ marginBottom: 16 }}>
        <div className="dash-panel__head">
          <h2>Histórico</h2>
          <p>Últimos snapshots (CPU / RAM)</p>
        </div>
        {chartData.length === 0 ? (
          <div className="dash-empty">Aguardando heartbeats do agent.</div>
        ) : (
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit="%" />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-sidebar)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="cpu_pct" name="CPU" stroke="#818cf8" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="mem_pct" name="RAM" stroke="#22c55e" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="disk_pct" name="Disco" stroke="#f59e0b" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div className="dash-grid-2">
        <section className="glass dash-panel">
          <div className="dash-panel__head">
            <h2>Discos</h2>
          </div>
          <ul className="dash-top-list">
            {(m.disks || []).map((d) => (
              <li key={d.mount}>
                <div className="dash-top-list__row">
                  <div className="dash-top-list__main">
                    <div className="dash-top-list__name">{d.mount}</div>
                    <div className="dash-top-list__bar">
                      <div className="dash-top-list__fill" style={{ width: `${d.usage_pct}%` }} />
                    </div>
                  </div>
                  <span className="dash-top-list__value">{d.usage_pct}%</span>
                </div>
              </li>
            ))}
            {!m.disks?.length && <li className="dash-empty">Sem dados</li>}
          </ul>
        </section>

        <section className="glass dash-panel">
          <div className="dash-panel__head">
            <h2>Rede</h2>
          </div>
          <div className="analytics-table-wrap">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Iface</th>
                  <th>RX</th>
                  <th>TX</th>
                </tr>
              </thead>
              <tbody>
                {(m.network || []).slice(0, 12).map((n) => (
                  <tr key={n.iface}>
                    <td>{n.iface}</td>
                    <td>{(n.rx_bytes / 1e6).toFixed(1)} MB</td>
                    <td>{(n.tx_bytes / 1e6).toFixed(1)} MB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="dash-grid-2" style={{ marginTop: 16 }}>
        <section className="glass dash-panel">
          <div className="dash-panel__head">
            <h2>Containers</h2>
            <p>
              {m.docker?.available
                ? `${(m.docker.containers || m.containers || []).length} via Docker`
                : 'Snapshot Docker'}
            </p>
          </div>
          {((m.docker?.containers || m.containers) || []).length === 0 ? (
            <div className="dash-empty">Nenhum container (ou Docker ausente)</div>
          ) : (
            <div className="analytics-table-wrap">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Estado</th>
                    <th>CPU</th>
                    <th>RAM</th>
                    <th>Restarts</th>
                  </tr>
                </thead>
                <tbody>
                  {(m.docker?.containers || m.containers || []).map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.image}</div>
                      </td>
                      <td>{c.state || c.status}</td>
                      <td>{c.cpu_pct != null ? `${c.cpu_pct.toFixed(1)}%` : '—'}</td>
                      <td>{c.mem_pct != null ? `${c.mem_pct.toFixed(1)}%` : '—'}</td>
                      <td>{c.restart_count ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(m.docker?.volumes?.length || 0) > 0 && (
            <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              {m.docker!.volumes.length} volumes · {m.docker!.networks.length} networks ·{' '}
              <Link to="/docker">Ver Docker</Link>
            </p>
          )}
        </section>

        <section className="glass dash-panel">
          <div className="dash-panel__head">
            <h2>Serviços</h2>
          </div>
          {(m.services || []).length === 0 ? (
            <div className="dash-empty">Sem serviços listados</div>
          ) : (
            <ul className="dash-top-list">
              {m.services!.slice(0, 20).map((s) => (
                <li key={s.name}>
                  <div className="dash-top-list__main">
                    <div className="dash-top-list__name">{s.name}</div>
                    <div className="dash-top-list__meta">{s.active}{s.sub ? ` / ${s.sub}` : ''}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {(m.docker?.logs?.length || 0) > 0 && (
        <section className="glass dash-panel" style={{ marginTop: 16 }}>
          <div className="dash-panel__head">
            <h2>Logs Docker</h2>
            <p>Tail dos containers neste host</p>
          </div>
          <div className="agent-logs">
            {m.docker!.logs.slice(0, 3).flatMap((log) =>
              log.lines.slice(-8).map((line, i) => (
                <div key={`${log.container_id}-${i}`} className="agent-logs__line">
                  <span className="agent-logs__meta">{log.container}</span>
                  <span>{line}</span>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      <section className="glass dash-panel" style={{ marginTop: 16 }}>
        <div className="dash-panel__head">
          <h2>Logs recentes</h2>
        </div>
        {(m.logs || []).length === 0 ? (
          <div className="dash-empty">Sem logs (journalctl indisponível)</div>
        ) : (
          <div className="agent-logs">
            {m.logs!.map((line, i) => (
              <div key={i} className="agent-logs__line">
                <span className="agent-logs__meta">
                  {line.ts || ''} {line.unit || ''}
                </span>
                <span>{line.message}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
