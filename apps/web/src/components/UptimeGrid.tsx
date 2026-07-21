import React from 'react';
import type { UptimeDay } from '../types';

interface UptimeGridProps {
  days: UptimeDay[];
  /** Total days to show, padded with empty cells on the left */
  totalDays?: number;
}

function getDayColor(day: UptimeDay | null): string {
  if (!day || day.total_pings === 0) return 'uptime-cell-empty';
  if (day.uptime_pct >= 99) return 'uptime-cell-up';
  if (day.uptime_pct >= 50) return 'uptime-cell-partial';
  return 'uptime-cell-down';
}

function formatDate(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export const UptimeGrid: React.FC<UptimeGridProps> = ({ days, totalDays = 90 }) => {
  // Build a map keyed by ISO date for O(1) lookups
  const dayMap = new Map(days.map(d => [d.day, d]));

  // Generate the last `totalDays` dates
  const cells: (UptimeDay | null)[] = [];
  for (let i = totalDays - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const iso = date.toISOString().split('T')[0];
    cells.push(dayMap.get(iso) ?? null);
  }

  return (
    <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexWrap: 'nowrap', overflowX: 'auto' }}>
      {cells.map((day, idx) => {
        const colorClass = getDayColor(day);
        const label = day
          ? `${formatDate(day.day)} — ${day.uptime_pct.toFixed(1)}% uptime (${day.total_pings} checks)`
          : 'Sem dados';

        return (
          <div key={idx} className="tooltip-wrapper">
            <div className={`uptime-cell ${colorClass}`} />
            <div className="tooltip" style={{ left: idx < 10 ? '0' : idx > 80 ? 'auto' : '50%', right: idx > 80 ? '0' : 'auto', transform: idx < 10 || idx > 80 ? 'none' : 'translateX(-50%)' }}>
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
};
