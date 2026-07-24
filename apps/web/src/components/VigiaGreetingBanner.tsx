import React, { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
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
    <div className="vigia-banner">
      <div className="vigia-banner__icon" aria-hidden>
        <Shield size={18} />
      </div>
      <div className="vigia-banner__body">
        <div className="vigia-banner__title">
          {greeting.salutation} — Vigia
          <span className={`vigia-online ${greeting.status.online ? 'is-on' : 'is-off'}`}>
            {greeting.status.online ? 'Online' : 'Aguardando'} · {greeting.status.mode}
          </span>
        </div>
        <ul className="vigia-brief">
          {greeting.lines.slice(0, 4).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <Link to="/vigia" className="vigia-banner__link">
          Abrir painel do Vigia →
        </Link>
      </div>
      <button
        type="button"
        className="btn btn-ghost"
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
