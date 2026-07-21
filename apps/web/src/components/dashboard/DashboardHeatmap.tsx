import React from 'react';
import { Link } from 'react-router-dom';
import type { DashboardHeatmapRow } from '../../types';
import { UptimeGrid } from '../UptimeGrid';

interface Props {
  rows: DashboardHeatmapRow[];
}

export const DashboardHeatmap: React.FC<Props> = ({ rows }) => {
  if (rows.length === 0) {
    return (
      <div className="dash-empty">Sem monitores para heatmap.</div>
    );
  }

  return (
    <div className="dash-heatmap">
      {rows.map((row) => (
        <div key={row.monitor_id} className="dash-heatmap__row">
          <div className="dash-heatmap__meta">
            <Link to={`/monitors/${row.monitor_id}`} className="dash-heatmap__name">
              {row.name}
            </Link>
            <span
              className={`dash-heatmap__uptime ${
                row.uptime_90d != null && row.uptime_90d >= 99.9
                  ? 'is-good'
                  : row.uptime_90d != null && row.uptime_90d < 99
                    ? 'is-bad'
                    : ''
              }`}
            >
              {row.uptime_90d != null ? `${row.uptime_90d.toFixed(2)}%` : '—'}
            </span>
          </div>
          <UptimeGrid days={row.days} totalDays={90} />
        </div>
      ))}
    </div>
  );
};
