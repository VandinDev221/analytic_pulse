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
  Activity,
  AlertTriangle,
  Lock,
  Cpu,
  Zap,
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
import { SmartStatCard } from '../components/dashboard/SmartStatCard';
import { useLiveData } from '../hooks/useLiveData';

function modeLabel(mode: VigiaMode): string {
  if (mode === 'remediate') return 'Remediar';
  if (mode === 'pause') return 'Pausado';
  return 'Observar';
}

function statusTone(
  status: string
): 'default' | 'good' | 'bad' | 'warn' {
  if (status === 'succeeded') return 'good';
  if (status === 'failed') return 'bad';
  if (status === 'proposed' || status === 'running') return 'warn';
  return 'default';
}

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
    return (
      <div className="page page--wide">
        <p className="vigia-muted">Carregando Vigia...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page page--wide">
        <div className="glass vigia-alert vigia-alert--error">
          {error || 'Vigia indisponível'}
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  const s = data.status;
  const summary = data.greeting.summary;

  return (
    <div className="page page--wide vigia-page">
      <div className="vigia-hero">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div>
            <div className="page-header__title-row">
              <h1>
                <Shield size={22} className="vigia-hero__icon" /> Vigia
              </h1>
              <LiveIndicator status={liveStatus} />
              <span className={`vigia-online ${s.online ? 'is-on' : 'is-off'}`}>
                {s.online ? 'Online' : 'Aguardando ronda'}
              </span>
            </div>
            <p className="page-header__desc">
              {data.greeting.salutation}. Plantão em modo{' '}
              <strong>{modeLabel(s.mode)}</strong>
              {s.circuit_open_until ? ' · circuit breaker ativo' : ''}.
            </p>
          </div>
          <div className="page-header__actions">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => void load()}
            >
              <RefreshCw size={14} /> Atualizar
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => void onRound()}
            >
              <Eye size={14} /> Ronda
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void onDigest()}
            >
              <FileText size={14} /> Relatório
            </button>
          </div>
        </div>

        <ul className="vigia-brief">
          {data.greeting.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      {error ? (
        <div className="glass-sm vigia-alert vigia-alert--error">{error}</div>
      ) : null}

      <div className="vigia-modes" role="group" aria-label="Modo do Vigia">
        {(
          [
            ['observe', 'Observar', Eye],
            ['remediate', 'Remediar', Play],
            ['pause', 'Pausar', Pause],
          ] as const
        ).map(([mode, label, Icon]) => (
          <button
            key={mode}
            type="button"
            className={`vigia-mode ${s.mode === mode ? 'is-active' : ''}`}
            disabled={busy}
            onClick={() => void changeMode(mode)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      <div className="dash-grid-4" style={{ marginBottom: 20 }}>
        <SmartStatCard
          label="Monitores"
          value={String(summary.monitors_total)}
          hint={`${summary.monitors_down} down`}
          tone={summary.monitors_down > 0 ? 'bad' : 'good'}
          icon={<Activity size={14} />}
        />
        <SmartStatCard
          label="Incidentes"
          value={String(summary.incidents_open)}
          hint={`${summary.incidents_resolved_24h} resolvidos (24h)`}
          tone={summary.incidents_open > 0 ? 'warn' : 'good'}
          icon={<AlertTriangle size={14} />}
        />
        <SmartStatCard
          label="SSL"
          value={String(summary.ssl_critical)}
          hint="no limiar de aviso"
          tone={summary.ssl_critical > 0 ? 'warn' : 'default'}
          icon={<Lock size={14} />}
        />
        <SmartStatCard
          label="Agents"
          value={String(summary.agents_offline)}
          hint="sem heartbeat"
          tone={summary.agents_offline > 0 ? 'warn' : 'good'}
          icon={<Cpu size={14} />}
        />
        <SmartStatCard
          label="RUM erros"
          value={String(summary.rum_errors_24h)}
          hint="últimas 24h"
          tone={summary.rum_errors_24h > 0 ? 'warn' : 'default'}
          icon={<Zap size={14} />}
        />
        <SmartStatCard
          label="Ações"
          value={String(summary.actions_24h)}
          hint="do Vigia (24h)"
          icon={<Shield size={14} />}
        />
      </div>

      <div className="vigia-columns">
        <section className="glass vigia-panel">
          <div className="dash-panel__head">
            <h2>O Vigia viu</h2>
            <p>Propostas e ações recentes (auditável)</p>
          </div>
          {data.recent_actions.length === 0 ? (
            <div className="dash-empty">Nenhuma ação ainda. Rode uma ronda ou aguarde o cron.</div>
          ) : (
            <ul className="vigia-action-list">
              {data.recent_actions.slice(0, 20).map((a) => (
                <li key={a.id} className={`vigia-action vigia-action--${statusTone(a.status)}`}>
                  <div className="vigia-action__row">
                    <strong>{a.title}</strong>
                    <span className="vigia-pill">
                      {a.status} · {a.severity}
                    </span>
                  </div>
                  {a.explanation ? (
                    <p className="vigia-action__expl">{a.explanation}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="glass vigia-panel vigia-panel--chat">
          <div className="dash-panel__head">
            <h2>Conversar</h2>
            <p>Pergunte o que aconteceu — respostas com dados reais</p>
          </div>
          <div ref={listRef} className="vigia-chat-log">
            {messages.length === 0 ? (
              <div className="dash-empty">
                Ex.: “O que está down?” ou “Resumo das últimas horas”
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={`${m.role}-${i}`}
                  className={`vigia-bubble vigia-bubble--${m.role}`}
                >
                  {m.role === 'assistant' ? (
                    <ChatMarkdown content={m.content} />
                  ) : (
                    <span>{m.content}</span>
                  )}
                </div>
              ))
            )}
            {chatLoading ? (
              <div className="vigia-muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Pensando…
              </div>
            ) : null}
          </div>
          <div className="vigia-chat-compose">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={2}
              placeholder="O que aconteceu nas últimas horas?"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendChat();
                }
              }}
            />
            <button
              type="button"
              className="btn"
              disabled={chatLoading || !input.trim()}
              onClick={() => void sendChat()}
              aria-label="Enviar"
            >
              <Send size={14} />
            </button>
          </div>
        </section>
      </div>

      {data.predictions.length > 0 ? (
        <section className="glass vigia-panel" style={{ marginTop: 16 }}>
          <div className="dash-panel__head">
            <h2>Antecipações</h2>
            <p>Sinais antes de virar incidente</p>
          </div>
          <ul className="vigia-predict-list">
            {data.predictions.map((p) => (
              <li key={`${p.kind}-${p.title}`}>
                <span className={`vigia-pill vigia-pill--${p.severity}`}>{p.severity}</span>
                <div>
                  <strong>{p.title}</strong>
                  <p>{p.explanation}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.recent_rounds.length > 0 ? (
        <section className="glass vigia-panel" style={{ marginTop: 16 }}>
          <div className="dash-panel__head">
            <h2>Rondas recentes</h2>
            <p>Heartbeat do plantão 24h</p>
          </div>
          <ul className="vigia-rounds">
            {data.recent_rounds.map((r) => (
              <li key={r.id}>
                <time>{new Date(r.started_at).toLocaleString('pt-BR')}</time>
                <span>
                  {modeLabel(r.mode)} · {r.findings} achados · {r.actions_run} ações
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};
