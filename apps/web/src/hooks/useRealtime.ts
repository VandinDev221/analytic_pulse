import { useEffect, useRef, useState } from 'react';

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') ||
  'https://analytic-pulse-api.onrender.com';

export type RealtimeEventType =
  | 'heartbeat'
  | 'connected'
  | 'monitor.updated'
  | 'incident.changed'
  | 'agent.updated'
  | 'alert.delivered'
  | 'ping.cycle';

export interface RealtimeEvent {
  type: RealtimeEventType;
  at: string;
  payload?: Record<string, unknown>;
}

export type RealtimeStatus = 'connecting' | 'live' | 'offline';

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

function parseSseChunk(
  buffer: string,
  onEvent: (event: RealtimeEvent) => void
): string {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';

  for (const block of parts) {
    if (!block.trim()) continue;
    let eventName = 'message';
    const dataLines: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    }
    if (dataLines.length === 0) continue;
    try {
      const parsed = JSON.parse(dataLines.join('\n')) as RealtimeEvent;
      if (!parsed.type) parsed.type = eventName as RealtimeEventType;
      onEvent(parsed);
    } catch {
      // ignore malformed frames
    }
  }

  return rest;
}

/**
 * Mantém SSE autenticado com Bearer via fetch stream.
 * Reconecta com backoff; pausa quando a aba fica oculta.
 */
export function useRealtime(
  onEvent: (event: RealtimeEvent) => void,
  enabled = true
): { status: RealtimeStatus } {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) {
      setStatus('offline');
      return;
    }

    let cancelled = false;
    let abort: AbortController | null = null;
    let reconnectTimer: number | undefined;
    let attempt = 0;
    let buffer = '';

    const connect = async () => {
      if (cancelled) return;
      if (document.visibilityState === 'hidden') {
        setStatus('offline');
        return;
      }

      const token = localStorage.getItem('pingpulse_token');
      if (!token) {
        setStatus('offline');
        return;
      }

      abort?.abort();
      abort = new AbortController();
      setStatus(attempt === 0 ? 'connecting' : 'connecting');

      try {
        const res = await fetch(`${API_BASE}/api/events/stream`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
          signal: abort.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`SSE HTTP ${res.status}`);
        }

        attempt = 0;
        setStatus('live');
        buffer = '';

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          buffer = parseSseChunk(buffer, (event) => {
            if (event.type === 'heartbeat' || event.type === 'connected') {
              setStatus('live');
              return;
            }
            onEventRef.current(event);
          });
        }

        if (!cancelled) throw new Error('SSE stream ended');
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) {
          return;
        }
        setStatus('offline');
        const delay = Math.min(
          RECONNECT_BASE_MS * 2 ** attempt,
          RECONNECT_MAX_MS
        );
        attempt += 1;
        reconnectTimer = window.setTimeout(() => {
          void connect();
        }, delay);
      }
    };

    void connect();

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        attempt = 0;
        void connect();
      } else {
        abort?.abort();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      abort?.abort();
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);

  return { status };
}
