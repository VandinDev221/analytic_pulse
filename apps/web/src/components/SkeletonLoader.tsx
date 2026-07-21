import React from 'react';
import { Skeleton } from '@analytic-pulse/ui';

export const MonitorCardSkeleton: React.FC = () => (
  <div className="glass" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Skeleton width={140} height={18} />
      <Skeleton width={60} height={22} radius={99} />
    </div>
    <Skeleton width={220} height={13} />
    <div style={{ display: 'flex', gap: 24 }}>
      <Skeleton width={80} height={13} />
      <Skeleton width={80} height={13} />
    </div>
    <Skeleton width="100%" height={28} radius={3} />
  </div>
);

export const GridSkeleton: React.FC = () => (
  <div style={{ display: 'flex', gap: 3 }}>
    {Array.from({ length: 90 }).map((_, i) => (
      <Skeleton key={i} width={10} height={28} radius={3} style={{ flexShrink: 0 }} />
    ))}
  </div>
);

export const ChartSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ display: 'flex', gap: 24 }}>
      <Skeleton width={140} height={13} />
      <Skeleton width={100} height={13} />
    </div>
    <Skeleton width="100%" height={200} radius={8} />
  </div>
);

export const DashboardSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
    {Array.from({ length: 3 }).map((_, i) => (
      <MonitorCardSkeleton key={i} />
    ))}
  </div>
);
