import React from 'react';
import { Link } from 'react-router-dom';
import type { DashboardTopIncident, DashboardTopLatency } from '../../types';

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d`;
}

export const TopLatencies: React.FC<{ items: DashboardTopLatency[] }> = ({ items }) => {
  if (items.length === 0) {
    return <div className="dash-empty">Sem dados de latência (7d).</div>;
  }

  const max = Math.max(...items.map((i) => i.avg_latency_7d), 1);

  return (
    <ul className="dash-top-list">
      {items.map((item, idx) => (
        <li key={item.monitor_id}>
          <Link to={`/monitors/${item.monitor_id}`} className="dash-top-list__row">
            <span className="dash-top-list__rank">{idx + 1}</span>
            <div className="dash-top-list__main">
              <div className="dash-top-list__name">{item.name}</div>
              <div className="dash-top-list__bar">
                <div
                  className="dash-top-list__fill"
                  style={{ width: `${(item.avg_latency_7d / max) * 100}%` }}
                />
              </div>
            </div>
            <span className="dash-top-list__value">{item.avg_latency_7d} ms</span>
          </Link>
        </li>
      ))}
    </ul>
  );
};

export const TopIncidents: React.FC<{ items: DashboardTopIncident[] }> = ({ items }) => {
  if (items.length === 0) {
    return <div className="dash-empty">Nenhum incidente nos últimos 90 dias.</div>;
  }

  return (
    <ul className="dash-top-list">
      {items.map((item) => (
        <li key={item.id}>
          <Link to={`/incidents/${item.id}`} className="dash-top-list__row">
            <span className={`dash-sev dash-sev--${item.severity}`}>{item.severity}</span>
            <div className="dash-top-list__main">
              <div className="dash-top-list__name">{item.title}</div>
              <div className="dash-top-list__meta">
                {item.status} · {formatDuration(item.duration_ms)}
                {item.affected_monitor_names.length > 0 &&
                  ` · ${item.affected_monitor_names.slice(0, 2).join(', ')}`}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
};
