import { useEffect, useRef } from 'react';

/** Recarrega dados em intervalo; refresca ao voltar para a aba. */
export function usePolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled = true
): void {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const tick = () => void saved.current();
    const id = setInterval(tick, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs, enabled]);
}

export const POLL_INTERVAL_MS = 30_000;
