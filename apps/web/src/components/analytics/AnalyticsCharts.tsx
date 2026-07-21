import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import type { AnalyticsAvailabilityPoint, AnalyticsLatencyPoint } from '../../types';

function formatBucket(bucket: string): string {
  if (bucket.includes('T')) {
    const d = new Date(bucket);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit' });
  }
  return new Date(bucket + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

const tipStyle = {
  background: 'var(--bg-sidebar)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 12,
};

export const LatencyPercentileChart: React.FC<{ series: AnalyticsLatencyPoint[] }> = ({
  series,
}) => {
  if (!series.length) {
    return <div className="dash-empty">Sem dados de latência no período.</div>;
  }

  const data = series.map((p) => ({
    ...p,
    label: formatBucket(p.bucket),
  }));

  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
            unit=" ms"
          />
          <Tooltip
            contentStyle={tipStyle}
            labelStyle={{ color: 'var(--text-secondary)' }}
            formatter={(value) => [`${value} ms`, '']}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
          <Line type="monotone" dataKey="avg_ms" name="Média" stroke="#818cf8" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="p50_ms" name="P50" stroke="#22c55e" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="p95_ms" name="P95" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="p99_ms" name="P99" stroke="#ef4444" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const AvailabilityChart: React.FC<{ series: AnalyticsAvailabilityPoint[] }> = ({
  series,
}) => {
  if (!series.length) {
    return <div className="dash-empty">Sem dados de disponibilidade no período.</div>;
  }

  const data = series.map((p) => ({
    ...p,
    label: formatBucket(p.day),
  }));

  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="availFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            domain={[90, 100]}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
            unit="%"
          />
          <Tooltip
            contentStyle={tipStyle}
            formatter={(value) => [`${Number(value).toFixed(3)}%`, 'Uptime']}
          />
          <Area
            type="monotone"
            dataKey="uptime_pct"
            name="Disponibilidade"
            stroke="#22c55e"
            fill="url(#availFill)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
