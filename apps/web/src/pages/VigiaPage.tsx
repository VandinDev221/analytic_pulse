import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Shield,
  RefreshCw,
  Send,
  Loader2,
  Play,
  Pause,
  Eye,
  FileText,
} from 'lucide-react';
import {
  getVigiaOverview,
  setVigiaMode,
  generateVigiaDigest,
  runVigiaRound,
  chatWithVigia,
  type AssistantChatMessage,
} from '../services/api';
import type { VigiaMode, VigiaOverview } from '../types';
import { ChatMarkdown } from '../components/ChatMarkdown';
import { LiveIndicator } from '../components/LiveIndicator';
import { useLiveData } from '../hooks/useLiveData';

export const VigiaPage: React.FC = () => {
  const [data, setData] = useState<VigiaOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const overview = await getVigiaOverview();
      setData(overview);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar Vigia');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { status: liveStatus } = useLiveData(
    () => {
      void load();
    },
    true,
    ['vigia.action', 'vigia.round', 'incident.changed', 'monitor.updated']
  );

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, chatLoading]);

  async function changeMode(mode: VigiaMode) {
    setBusy(true);
    try {
      await setVigiaMode(mode);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao mudar modo');
    } finally {
      setBusy(false);
    }
  }

  async function onDigest() {
    setBusy(true);
    try {
      await generateVigiaDigest(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no digest');
    } finally {
      setBusy(false);
    }
  }

  async function onRound() {
    setBusy(true);
    try {
      await runVigiaRound();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na ronda');
    } finally {
      setBusy(false);
    }
  }

  async function sendChat() {
    const text = input.trim();
    if (!text || chatLoading) return;
    const next: AssistantChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setChatLoading(true);
    try {
      const reply = await chatWithVigia(next);
      setMessages([...next, reply]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no chat');
    } finally {
      setChatLoading(false);
    }
  }

  if (loading) {
    return <p style={{ color: 'var(--text-muted)' }}>Carregando Vigia...</p>;
  }

  if (!data) {
    return <p style={{ color: 'var(--danger, #ef4444)' }}>{error || 'Vigia indisponível'}</p>;
  }

  const s = data.status;
  const summary = data.greeting.summary;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={22} /> Vigia
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: s.online ? '#22c55e' : 'var(--text-muted)',
                display: 'inline-block',
              }}
              title={s.online ? 'Online' : 'Aguardando ronda'}
            />
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            {data.greeting.salutation}. Modo <strong>{s.mode}</strong>
            {s.circuit_open_until ? ' · circuit breaker ativo' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <LiveIndicator status={liveStatus} />
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void load()}>
            <RefreshCw size={14} /> Atualizar
          </button>
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void onRound()}>
            <Eye size={14} /> Ronda
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => void onDigest()}>
            <FileText size={14} /> Relatório
          </button>
        </div>
      </div>

      {error ? (
        <div className="card" style={{ padding: 12, color: 'var(--danger, #ef4444)' }}>{error}</div>
      ) : null}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className={`btn ${s.mode === 'observe' ? '' : 'btn--ghost'}`} disabled={busy} onClick={() => void changeMode('observe')}>
          <Eye size={14} /> Observe
        </button>
        <button type="button" className={`btn ${s.mode === 'remediate' ? '' : 'btn--ghost'}`} disabled={busy} onClick={() => void changeMode('remediate')}>
          <Play size={14} /> Remediate
        </button>
        <button type="button" className={`btn ${s.mode === 'pause' ? '' : 'btn--ghost'}`} disabled={busy} onClick={() => void changeMode('pause')}>
          <Pause size={14} /> Pause
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        {[
          ['Monitores', summary.monitors_total],
          ['Down', summary.monitors_down],
          ['Incidentes', summary.incidents_open],
          ['SSL', summary.ssl_critical],
          ['Agents off', summary.agents_offline],
          ['RUM erros', summary.rum_errors_24h],
          ['Ações 24h', summary.actions_24h],
        ].map(([label, value]) => (
          <div key={String(label)} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 650, marginTop: 4 }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 15 }}>O Vigia viu (propostas / ações)</h2>
        {data.recent_actions.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma ação ainda.</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.recent_actions.slice(0, 20).map((a) => (
              <li key={a.id} style={{ borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))', paddingBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                  <strong>{a.title}</strong>
                  <span style={{ color: 'var(--text-muted)' }}>{a.status} · {a.severity}</span>
                </div>
                {a.explanation ? (
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>{a.explanation}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {data.predictions.length > 0 ? (
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 15 }}>Antecipações</h2>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
            {data.predictions.map((p) => (
              <li key={`${p.kind}-${p.title}`}>
                <strong>{p.title}</strong> — {p.explanation}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 280 }}>
        <h2 style={{ margin: 0, fontSize: 15 }}>Conversar com o Vigia</h2>
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', maxHeight: 320, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
              Pergunte o que aconteceu, peça o resumo ou detalhes das ações.
            </p>
          ) : (
            messages.map((m, i) => (
              <div key={`${m.role}-${i}`} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
                {m.role === 'assistant' ? (
                  <ChatMarkdown content={m.content} />
                ) : (
                  <span style={{ fontSize: 13 }}>{m.content}</span>
                )}
              </div>
            ))
          )}
          {chatLoading ? <Loader2 size={16} className="spin" /> : null}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder="O que aconteceu nas últimas horas?"
            style={{ flex: 1, resize: 'vertical' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendChat();
              }
            }}
          />
          <button type="button" className="btn" disabled={chatLoading || !input.trim()} onClick={() => void sendChat()}>
            <Send size={14} />
          </button>
        </div>
      </div>

      {data.recent_rounds.length > 0 ? (
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 15 }}>Rondas recentes</h2>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 12, color: 'var(--text-secondary)' }}>
            {data.recent_rounds.map((r) => (
              <li key={r.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border, rgba(255,255,255,0.06))' }}>
                {r.started_at} · modo {r.mode} · achados {r.findings} · ações {r.actions_run}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};
