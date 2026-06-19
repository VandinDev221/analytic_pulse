import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Activity, LayoutDashboard, LogOut, ExternalLink, Bell, Send, MessageCircle
} from 'lucide-react';
import {
  getNotificationSettings,
  saveNotificationSettings,
  testNotificationSettings,
} from '../services/api';
import type { NotificationChannel } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  userSlug?: string;
}

export const AppLayout: React.FC<LayoutProps> = ({ children, userSlug }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showSettings, setShowSettings] = useState(false);

  async function handleLogout() {
    localStorage.removeItem('pingpulse_token');
    window.dispatchEvent(new Event('auth-state-change'));
    navigate('/login');
  }

  const navItems = [
    { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
  ];

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Logo */}
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 16px rgba(99,102,241,0.35)',
              flexShrink: 0,
            }}>
              <Activity size={17} color="#fff" />
            </div>
            <span style={{ fontSize: 16, fontWeight: 700 }}>
              Ping<span className="gradient-text">Pulse</span>
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1 }}>
          {navItems.map(item => (
            <a
              key={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
              style={{ cursor: 'pointer' }}
            >
              {item.icon}
              {item.label}
            </a>
          ))}

          <button
            className={`nav-item ${showSettings ? 'active' : ''}`}
            style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer' }}
            onClick={() => setShowSettings(true)}
          >
            <Bell size={16} />
            Notificações
          </button>

          {userSlug && (
            <a
              className="nav-item"
              href={`/status/${userSlug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={16} />
              Página Pública
            </a>
          )}
        </nav>

        {/* Bottom logout */}
        <div style={{ padding: '16px 0', borderTop: '1px solid var(--border)' }}>
          <button
            className="nav-item"
            style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--red)' }}
            onClick={handleLogout}
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {children}
      </main>

      {/* Notification Settings Modal */}
      {showSettings && <NotificationSettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
};

// ── Notification Settings Modal ───────────────────────────────
const TAPDIGITS_URL = 'https://tapdigits.com';
const CALLMEBOT_ACTIVATE = 'https://wa.me/34644447167?text=I%20allow%20callmebot%20to%20send%20me%20messages';

const NotificationSettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [channel, setChannel] = useState<NotificationChannel>('telegram');
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [whatsappApiKey, setWhatsappApiKey] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getNotificationSettings()
      .then((s) => {
        setChannel(s.notification_channel || 'telegram');
        setBotToken(s.telegram_bot_token || '');
        setChatId(s.telegram_chat_id || '');
        setWhatsappPhone(s.whatsapp_phone || '');
        setWhatsappApiKey(s.whatsapp_api_key || '');
        setEnabled(s.is_enabled ?? false);
      })
      .catch(() => setError('Erro ao carregar configurações'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await saveNotificationSettings({
        notification_channel: channel,
        telegram_bot_token: botToken,
        telegram_chat_id: chatId,
        whatsapp_phone: whatsappPhone,
        whatsapp_api_key: whatsappApiKey,
        is_enabled: enabled,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setError('');
    try {
      await saveNotificationSettings({
        notification_channel: channel,
        telegram_bot_token: botToken,
        telegram_chat_id: chatId,
        whatsapp_phone: whatsappPhone,
        whatsapp_api_key: whatsappApiKey,
        is_enabled: true,
      });
      await testNotificationSettings();
      alert('Notificação de teste enviada! Verifique seu ' + (channel === 'whatsapp' ? 'WhatsApp' : 'Telegram') + '.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha no teste');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Alertas</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Receba avisos quando um serviço cair ou voltar.
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: 8 }}>✕</button>
        </div>

        {/* Channel toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button
            type="button"
            className={`btn ${channel === 'telegram' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={() => setChannel('telegram')}
          >
            <Send size={16} /> Telegram
          </button>
          <button
            type="button"
            className={`btn ${channel === 'whatsapp' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={() => setChannel('whatsapp')}
          >
            <MessageCircle size={16} /> WhatsApp
          </button>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Carregando...</p>
        ) : (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {channel === 'telegram' ? (
              <>
                <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--accent-light)' }}>Telegram:</strong><br />
                  1. Crie um bot com <code>@BotFather</code><br />
                  2. Envie <code>/start</code> ao <code>@PulseAssistentBot</code> para obter seu Chat ID
                </div>
                <div className="form-group">
                  <label className="form-label">Bot Token</label>
                  <input className="input" placeholder="1234567890:ABCdef..." value={botToken} onChange={e => setBotToken(e.target.value)} style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Chat ID</label>
                  <input className="input" placeholder="8350092970" value={chatId} onChange={e => setChatId(e.target.value)} style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }} />
                </div>
              </>
            ) : (
              <>
                <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <strong style={{ color: '#4ade80' }}>WhatsApp:</strong><br />
                  1. Obtenha um número em{' '}
                  <a href={TAPDIGITS_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#4ade80' }}>
                    TapDigits
                  </a>{' '}
                  (grátis, 150+ países)<br />
                  2.{' '}
                  <a href={CALLMEBOT_ACTIVATE} target="_blank" rel="noopener noreferrer" style={{ color: '#4ade80' }}>
                    Ative o CallMeBot
                  </a>{' '}
                  no WhatsApp (envie a mensagem de autorização)<br />
                  3. Copie a <strong>API Key</strong> que o CallMeBot responder
                </div>
                <div className="form-group">
                  <label className="form-label">Número WhatsApp (com DDI, sem +)</label>
                  <input className="input" placeholder="5585999999999" value={whatsappPhone} onChange={e => setWhatsappPhone(e.target.value)} style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }} />
                </div>
                <div className="form-group">
                  <label className="form-label">CallMeBot API Key</label>
                  <input className="input" placeholder="123456" value={whatsappApiKey} onChange={e => setWhatsappApiKey(e.target.value)} style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }} />
                </div>
              </>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
              Notificações ativadas
            </label>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171' }}>
                {error}
              </div>
            )}

            {saved && (
              <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#4ade80' }}>
                ✓ Configurações salvas!
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              <button type="button" className="btn btn-ghost" onClick={handleTest} disabled={testing || saving}>
                {testing ? 'Enviando...' : 'Enviar teste'}
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
