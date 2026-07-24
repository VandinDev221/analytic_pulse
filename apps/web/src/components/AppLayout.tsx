import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Activity, LayoutDashboard, LogOut, ExternalLink, Bell, Send, MessageCircle, Menu, X, ShieldAlert, Zap, Globe, Map, BarChart3, Lock, Server, Cpu, Box, Ship, KeyRound, BookOpen, Eye
} from 'lucide-react';
import {
  getNotificationSettings,
  saveNotificationSettings,
  testNotificationSettings,
} from '../services/api';
import type { NotificationChannel } from '../types';
import { HelpAssistant } from './HelpAssistant';

interface LayoutProps {
  children: React.ReactNode;
  userSlug?: string;
}

export const AppLayout: React.FC<LayoutProps> = ({ children, userSlug }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  async function handleLogout() {
    localStorage.removeItem('pingpulse_token');
    window.dispatchEvent(new Event('auth-state-change'));
    navigate('/login');
  }

  function openSettings() {
    setMenuOpen(false);
    setShowSettings(true);
  }

  const navItems = [
    { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { path: '/analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
    { path: '/rum', label: 'RUM', icon: <Eye size={18} /> },
    { path: '/ssl', label: 'SSL', icon: <Lock size={18} /> },
    { path: '/dns', label: 'DNS', icon: <Server size={18} /> },
    { path: '/agents', label: 'Agents', icon: <Cpu size={18} /> },
    { path: '/docker', label: 'Docker', icon: <Box size={18} /> },
    { path: '/kubernetes', label: 'Kubernetes', icon: <Ship size={18} /> },
    { path: '/api-keys', label: 'API', icon: <KeyRound size={18} /> },
    { path: '/map', label: 'Mapa', icon: <Map size={18} /> },
    { path: '/incidents', label: 'Incidentes', icon: <ShieldAlert size={18} /> },
    { path: '/alerts', label: 'Alertas', icon: <Zap size={18} /> },
    { path: '/status-page', label: 'Status Page', icon: <Globe size={18} /> },
    { path: '/docs', label: 'Docs', icon: <BookOpen size={18} /> },
  ];

  const sidebarContent = (
    <>
      <div className="sidebar__brand">
        <div className="sidebar__brand-row">
          <div className="sidebar__logo-icon">
            <Activity size={17} color="#fff" />
          </div>
          <span className="sidebar__logo-text">
            Ping<span className="gradient-text">Pulse</span>
          </span>
          <button
            type="button"
            className="sidebar__close"
            onClick={() => setMenuOpen(false)}
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <nav className="sidebar__nav">
        {navItems.map(item => {
          const active =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
          return (
          <a
            key={item.path}
            className={`nav-item ${active ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
            style={{ cursor: 'pointer' }}
          >
            {item.icon}
            {item.label}
          </a>
          );
        })}

        <button
          type="button"
          className={`nav-item ${showSettings ? 'active' : ''}`}
          onClick={openSettings}
        >
          <Bell size={18} />
          Notificações
        </button>

        {userSlug && (
          <a
            className="nav-item"
            href={`/status/${userSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuOpen(false)}
          >
            <ExternalLink size={18} />
            Página Pública
          </a>
        )}
      </nav>

      <div className="sidebar__footer">
        <button
          type="button"
          className="nav-item nav-item--danger"
          onClick={handleLogout}
        >
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </>
  );

  return (
    <div className="layout">
      <header className="mobile-header">
        <button
          type="button"
          className="mobile-header__menu"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu size={22} />
        </button>
        <div className="mobile-header__brand">
          <div className="sidebar__logo-icon sidebar__logo-icon--sm">
            <Activity size={15} color="#fff" />
          </div>
          <span className="mobile-header__title">
            Ping<span className="gradient-text">Pulse</span>
          </span>
        </div>
        <div className="mobile-header__actions">
          <button
            type="button"
            className="mobile-header__icon-btn"
            onClick={openSettings}
            aria-label="Notificações"
          >
            <Bell size={20} />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMenuOpen(false)}
          aria-hidden
        />
      )}

      <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
        {sidebarContent}
      </aside>

      <main className="main-content">
        {children}
      </main>

      <HelpAssistant />

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
      <div className="modal modal--settings">
        <div className="modal__header">
          <div>
            <h2 className="modal__title">Alertas</h2>
            <p className="modal__subtitle">Receba avisos quando um serviço cair ou voltar.</p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost modal__close" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="channel-toggle">
          <button
            type="button"
            className={`btn ${channel === 'telegram' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setChannel('telegram')}
          >
            <Send size={16} /> Telegram
          </button>
          <button
            type="button"
            className={`btn ${channel === 'whatsapp' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setChannel('whatsapp')}
          >
            <MessageCircle size={16} /> WhatsApp
          </button>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Carregando...</p>
        ) : (
          <form onSubmit={handleSave} className="modal__form">
            {channel === 'telegram' ? (
              <>
                <div className="info-box info-box--indigo">
                  <strong>Telegram:</strong><br />
                  1. Crie um bot com <code>@BotFather</code><br />
                  2. Envie <code>/start</code> ao <code>@PulseAssistentBot</code> para obter seu Chat ID
                </div>
                <div className="form-group">
                  <label className="form-label">Bot Token</label>
                  <input className="input input--mono" placeholder="1234567890:ABCdef..." value={botToken} onChange={e => setBotToken(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Chat ID</label>
                  <input className="input input--mono" placeholder="8350092970" value={chatId} onChange={e => setChatId(e.target.value)} inputMode="numeric" />
                </div>
              </>
            ) : (
              <>
                <div className="info-box info-box--green">
                  <strong>WhatsApp:</strong><br />
                  1. Obtenha um número em{' '}
                  <a href={TAPDIGITS_URL} target="_blank" rel="noopener noreferrer">TapDigits</a><br />
                  2.{' '}
                  <a href={CALLMEBOT_ACTIVATE} target="_blank" rel="noopener noreferrer">Ative o CallMeBot</a>{' '}
                  no WhatsApp<br />
                  3. Copie a <strong>API Key</strong> que o CallMeBot responder
                </div>
                <div className="form-group">
                  <label className="form-label">Número WhatsApp (com DDI, sem +)</label>
                  <input className="input input--mono" placeholder="5585999999999" value={whatsappPhone} onChange={e => setWhatsappPhone(e.target.value)} inputMode="tel" />
                </div>
                <div className="form-group">
                  <label className="form-label">CallMeBot API Key</label>
                  <input className="input input--mono" placeholder="123456" value={whatsappApiKey} onChange={e => setWhatsappApiKey(e.target.value)} inputMode="numeric" />
                </div>
              </>
            )}

            <label className="checkbox-row">
              <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
              Notificações ativadas
            </label>

            {error && <div className="alert alert--error">{error}</div>}
            {saved && <div className="alert alert--success">✓ Configurações salvas!</div>}

            <div className="modal__actions">
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
