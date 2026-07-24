import React from 'react';
import { Radio } from 'lucide-react';
import type { RealtimeStatus } from '../hooks/useRealtime';

interface LiveIndicatorProps {
  status: RealtimeStatus;
  className?: string;
}

/** Badge discreto do estado SSE. */
export const LiveIndicator: React.FC<LiveIndicatorProps> = ({
  status,
  className = '',
}) => {
  if (status === 'offline') {
    return (
      <span className={`live-badge live-badge--off ${className}`.trim()} title="Reconectando…">
        <Radio size={10} />
        Offline
      </span>
    );
  }

  if (status === 'connecting') {
    return (
      <span className={`live-badge live-badge--connecting ${className}`.trim()} title="Conectando ao vivo…">
        <Radio size={10} style={{ animation: 'pulse 1.2s ease-in-out infinite' }} />
        Conectando
      </span>
    );
  }

  return (
    <span className={`live-badge ${className}`.trim()} title="Atualizações em tempo real">
      <Radio size={10} style={{ animation: 'pulse 2s ease-in-out infinite' }} />
      Ao vivo
    </span>
  );
};
