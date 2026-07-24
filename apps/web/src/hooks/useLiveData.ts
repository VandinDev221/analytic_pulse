import { useCallback, useRef } from 'react';
import { usePolling } from './usePolling';
import {
  useRealtime,
  type RealtimeEvent,
  type RealtimeEventType,
  type RealtimeStatus,
} from './useRealtime';

/** Fallback raro quando SSE está offline. */
export const FALLBACK_POLL_MS = 5 * 60_000;

const DEFAULT_TYPES: RealtimeEventType[] = [
  'monitor.updated',
  'incident.changed',
  'agent.updated',
  'alert.delivered',
  'ping.cycle',
];

/**
 * Atualiza dados via SSE; polling longo só se a conexão ao vivo cair.
 */
export function useLiveData(
  refresh: () => void | Promise<void>,
  enabled = true,
  eventTypes: RealtimeEventType[] = DEFAULT_TYPES
): { status: RealtimeStatus; live: boolean } {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const timerRef = useRef<number | undefined>(undefined);

  const debouncedRefresh = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      void refreshRef.current();
    }, 400);
  }, []);

  const onEvent = useCallback(
    (event: RealtimeEvent) => {
      if (!eventTypes.includes(event.type)) return;
      debouncedRefresh();
    },
    [debouncedRefresh, eventTypes]
  );

  const { status } = useRealtime(onEvent, enabled);
  const live = status === 'live';

  usePolling(() => refreshRef.current(), FALLBACK_POLL_MS, enabled && !live);

  return { status, live };
}
