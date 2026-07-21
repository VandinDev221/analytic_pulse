import type { HTMLAttributes, ReactNode } from 'react';
import type { MonitorStatus } from '@analytic-pulse/shared';

export type BadgeTone = MonitorStatus | 'neutral';

const TONE_CLASS: Record<BadgeTone, string> = {
  up: 'ap-badge--up',
  down: 'ap-badge--down',
  active: 'ap-badge--active',
  inactive: 'ap-badge--inactive',
  unknown: 'ap-badge--unknown',
  neutral: 'ap-badge--unknown',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', className = '', children, ...props }: BadgeProps) {
  return (
    <span className={['ap-badge', TONE_CLASS[tone], className].filter(Boolean).join(' ')} {...props}>
      {children}
    </span>
  );
}

export function statusLabel(status: MonitorStatus): string {
  switch (status) {
    case 'up':
      return 'Up';
    case 'down':
      return 'Down';
    case 'active':
      return 'Active';
    case 'inactive':
      return 'Paused';
    default:
      return 'Unknown';
  }
}
