import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { DashboardUsage } from '../../types';

type Range = 'daily' | 'weekly' | 'monthly';

interface Props {
  usage: DashboardUsage;
}

const LABELS: Record<Range, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
};

export const UsageChart: React.FC<Props> = ({ usage }) => {
  const [range, setRange] = useState<Range>('daily');
  const data = useMemo(() => usage[range], [usage, range]);

  if (!data.length) {
    return <div className="dash-empty">Sem checks registrados ainda.</div>;
  }

  return (
    <div>
      <div className="dash-tabs">
        {(Object.keys(LABELS) as Range[]).map((key) => (
          <button
            key={key}
            type="button"
            className={`dash-tab ${range === key ? 'is-active' : ''}`}
            onClick={() => setRange(key)}
          >
            {LABELS[key]}
          </button>
        ))}
      </div>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-sidebar)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                fontSize: 12,
              }}
              labelStyle={{ color: 'var(--text-secondary)' }}
              formatter={(value) => [`${value} checks`, 'Volume']}
            />
            <Bar dataKey="checks" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
