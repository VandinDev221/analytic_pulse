import React from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import type { PingLog } from '../types';

interface LatencyChartProps {
  logs: PingLog[];
}

interface ChartPoint {
  time: string;
  latency: number | null;
  is_up: boolean;
  status_code: number | null;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as ChartPoint;
  return (
    <div className="glass-sm" style={{ padding: '10px 14px', fontSize: 12, minWidth: 160 }}>
      <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{d.time}</div>
      {d.latency !== null ? (
        <div style={{ color: 'var(--accent-light)', fontWeight: 600 }}>{d.latency} ms</div>
      ) : (
        <div style={{ color: 'var(--red)' }}>Offline</div>
      )}
      {d.status_code && (
        <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>HTTP {d.status_code}</div>
      )}
    </div>
  );
};

export const LatencyChart: React.FC<LatencyChartProps> = ({ logs }) => {
  if (!logs.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)', fontSize: 14 }}>
        Nenhum dado de latência ainda.
      </div>
    );
  }

  const data: ChartPoint[] = [...logs]
    .reverse()
    .map(log => ({
      time: new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      latency: log.is_up ? log.response_time_ms : null,
      is_up: log.is_up,
      status_code: log.status_code,
    }));

  const avg = Math.round(data.filter(d => d.latency !== null).reduce((s, d) => s + (d.latency ?? 0), 0) / data.filter(d => d.latency !== null).length);

  return (
    <div>
      <div style={{ display: 'flex', gap: 24, marginBottom: 16, fontSize: 13 }}>
        <span style={{ color: 'var(--text-secondary)' }}>
          Latência média: <strong style={{ color: 'var(--accent-light)' }}>{avg} ms</strong>
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>
          Último: <strong style={{ color: 'var(--text-primary)' }}>{data[data.length - 1]?.latency ?? 'Offline'} ms</strong>
        </span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            interval="preserveStartEnd"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
            unit=" ms"
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={avg} stroke="rgba(99,102,241,0.3)" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="latency"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#818cf8', stroke: '#6366f1', strokeWidth: 2 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
