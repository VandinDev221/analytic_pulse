import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X, Sparkles, Loader2 } from 'lucide-react';
import { chatWithAssistant, type AssistantChatMessage } from '../services/api';

const SUGGESTIONS = [
  'Como criar um monitor?',
  'O que é um incidente?',
  'Como configurar alertas?',
  'Para que serve a Status Page?',
];

export const HelpAssistant: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, loading, open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function send(content: string) {
    const text = content.trim();
    if (!text || loading) return;

    const nextMessages: AssistantChatMessage[] = [
      ...messages,
      { role: 'user', content: text },
    ];
    setMessages(nextMessages);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const reply = await chatWithAssistant(nextMessages);
      setMessages([...nextMessages, reply]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao falar com o assistente');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  return (
    <div className="help-assistant">
      {open && (
        <div
          className="help-assistant__panel"
          role="dialog"
          aria-label="Assistente PingPulse"
        >
          <header className="help-assistant__header">
            <div className="help-assistant__header-text">
              <div className="help-assistant__title-row">
                <Sparkles size={16} />
                <span>Assistente</span>
              </div>
              <p className="help-assistant__subtitle">
                Dúvidas sobre como o PingPulse funciona
              </p>
            </div>
            <button
              type="button"
              className="help-assistant__icon-btn"
              onClick={() => setOpen(false)}
              aria-label="Fechar assistente"
            >
              <X size={18} />
            </button>
          </header>

          <div className="help-assistant__messages" ref={listRef}>
            {messages.length === 0 && !loading && (
              <div className="help-assistant__empty">
                <p>Pergunte qualquer coisa sobre monitores, alertas, incidentes e mais.</p>
                <div className="help-assistant__suggestions">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="help-assistant__chip"
                      onClick={() => void send(s)}
                      disabled={loading}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={`help-assistant__bubble help-assistant__bubble--${m.role}`}
              >
                {m.content}
              </div>
            ))}

            {loading && (
              <div className="help-assistant__bubble help-assistant__bubble--assistant help-assistant__bubble--loading">
                <Loader2 size={16} className="help-assistant__spin" />
                Pensando…
              </div>
            )}

            {error && (
              <div className="help-assistant__error" role="alert">
                {error}
              </div>
            )}
          </div>

          <form className="help-assistant__form" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              className="help-assistant__input"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escreva sua dúvida…"
              disabled={loading}
              maxLength={2000}
              aria-label="Mensagem para o assistente"
            />
            <button
              type="submit"
              className="help-assistant__send"
              disabled={loading || !input.trim()}
              aria-label="Enviar"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className={`help-assistant__fab ${open ? 'help-assistant__fab--open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Fechar assistente' : 'Abrir assistente'}
        aria-expanded={open}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
};
