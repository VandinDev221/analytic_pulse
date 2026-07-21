import React from 'react';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { DashboardTrend } from '../../types';

interface SmartStatCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'good' | 'bad' | 'warn';
  trend?: DashboardTrend;
  /** Para latência: up = piora; para uptime: up = melhora */
  invertTrend?: boolean;
  icon?: React.ReactNode;
}

function trendColor(trend: DashboardTrend, invert?: boolean): string {
  if (trend.direction === 'unknown' || trend.direction === 'flat') return 'var(--text-muted)';
  const improving =
    invert
      ? trend.direction === 'down'
      : trend.direction === 'up';
  return improving ? 'var(--green)' : 'var(--red)';
}

export const SmartStatCard: React.FC<SmartStatCardProps> = ({
  label,
  value,
  hint,
  tone = 'default',
  trend,
  invertTrend,
  icon,
}) => {
  const toneClass =
    tone === 'good'
      ? 'smart-stat--good'
      : tone === 'bad'
        ? 'smart-stat--bad'
        : tone === 'warn'
          ? 'smart-stat--warn'
          : '';

  const TrendIcon =
    trend?.direction === 'up'
      ? TrendingUp
      : trend?.direction === 'down'
        ? TrendingDown
        : Minus;

  return (
    <div className={`glass-sm smart-stat ${toneClass}`}>
      <div className="smart-stat__top">
        <span className="smart-stat__label">{label}</span>
        {icon && <span className="smart-stat__icon">{icon}</span>}
      </div>
      <div className="smart-stat__value">{value}</div>
      <div className="smart-stat__footer">
        {hint && <span className="smart-stat__hint">{hint}</span>}
        {trend && trend.pct != null && (
          <span
            className="smart-stat__trend"
            style={{ color: trendColor(trend, invertTrend) }}
          >
            <TrendIcon size={12} />
            {trend.pct > 0 ? '+' : ''}
            {trend.pct}%
          </span>
        )}
      </div>
    </div>
  );
};
