import React from 'react';

// ── Card Skeleton ─────────────────────────────────────────────
export const MonitorCardSkeleton: React.FC = () => (
  <div className="glass" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div className="skeleton" style={{ width: 140, height: 18 }} />
      <div className="skeleton" style={{ width: 60, height: 22, borderRadius: 99 }} />
    </div>
    <div className="skeleton" style={{ width: 220, height: 13 }} />
    <div style={{ display: 'flex', gap: 24 }}>
      <div className="skeleton" style={{ width: 80, height: 13 }} />
      <div className="skeleton" style={{ width: 80, height: 13 }} />
    </div>
    <div className="skeleton" style={{ width: '100%', height: 28, borderRadius: 3 }} />
  </div>
);

// ── Grid Skeleton ─────────────────────────────────────────────
export const GridSkeleton: React.FC = () => (
  <div style={{ display: 'flex', gap: 3 }}>
    {Array.from({ length: 90 }).map((_, i) => (
      <div key={i} className="skeleton" style={{ width: 10, height: 28, borderRadius: 3, flexShrink: 0 }} />
    ))}
  </div>
);

// ── Chart Skeleton ────────────────────────────────────────────
export const ChartSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ display: 'flex', gap: 24 }}>
      <div className="skeleton" style={{ width: 140, height: 13 }} />
      <div className="skeleton" style={{ width: 100, height: 13 }} />
    </div>
    <div className="skeleton" style={{ width: '100%', height: 200, borderRadius: 8 }} />
  </div>
);

// ── Page Skeleton ─────────────────────────────────────────────
export const DashboardSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
    {Array.from({ length: 3 }).map((_, i) => (
      <MonitorCardSkeleton key={i} />
    ))}
  </div>
);
