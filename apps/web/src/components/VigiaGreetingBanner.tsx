import React, { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { getVigiaGreeting } from '../services/api';
import type { VigiaGreeting } from '../types';

const DISMISS_KEY = 'vigia_greeting_dismissed_date';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Banner de saudação no dashboard (V0) — uma vez por dia. */
export const VigiaGreetingBanner: React.FC = () => {
  const [greeting, setGreeting] = useState<VigiaGreeting | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === todayKey()) {
      setHidden(true);
      return;
    }
    getVigiaGreeting()
      .then((g) => {
        setGreeting(g);
        setHidden(false);
      })
      .catch(() => setHidden(true));
  }, []);

  if (hidden || !greeting) return null;

  return (
    <div
      className="card"
      style={{
        marginBottom: 20,
        padding: '16px 18px',
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
        border: '1px solid color-mix(in srgb, var(--accent, #6366f1) 35%, transparent)',
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--accent, #6366f1) 12%, transparent), transparent)',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          display: 'grid',
          placeItems: 'center',
          background: 'var(--accent, #6366f1)',
          color: '#fff',
          flexShrink: 0,
        }}
      >
        <Shield size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 650, fontSize: 15, marginBottom: 6 }}>
          {greeting.salutation} — Vigia{' '}
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: greeting.status.online ? '#22c55e' : 'var(--text-muted)',
            }}
          >
            ● {greeting.status.online ? 'online' : 'aguardando ronda'} · {greeting.status.mode}
          </span>
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.55 }}>
          {greeting.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        className="btn btn--ghost"
        style={{ fontSize: 12 }}
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, todayKey());
          setHidden(true);
        }}
      >
        Fechar
      </button>
    </div>
  );
};
