import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Activity, LayoutDashboard, Settings, LogOut, ExternalLink, Bell
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { saveNotificationSettings } from '../services/api';

interface LayoutProps {
  children: React.ReactNode;
  userSlug?: string;
}

export const AppLayout: React.FC<LayoutProps> = ({ children, userSlug }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showSettings, setShowSettings] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
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
const NotificationSettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId]     = useState('');
  const [enabled, setEnabled]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveNotificationSettings({ telegram_bot_token: botToken, telegram_chat_id: chatId, is_enabled: enabled });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert('Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Alertas via Telegram</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Receba notificações quando um serviço cair ou voltar.</p>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: 8 }}>✕</button>
        </div>

        <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '12px 14px', marginBottom: 20, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--accent-light)' }}>Como configurar:</strong><br />
          1. Fale com <code style={{ fontFamily: 'var(--font-mono)' }}>@BotFather</code> no Telegram para criar um bot e obter o token.<br />
          2. Envie uma mensagem para o bot e use <code style={{ fontFamily: 'var(--font-mono)' }}>@userinfobot</code> para obter seu Chat ID.
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Bot Token</label>
            <input id="bot-token-input" className="input" placeholder="1234567890:ABCdef..." value={botToken} onChange={e => setBotToken(e.target.value)} style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Chat ID</label>
            <input id="chat-id-input" className="input" placeholder="123456789" value={chatId} onChange={e => setChatId(e.target.value)} style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
            Notificações ativadas
          </label>

          {saved && (
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#4ade80' }}>
              ✓ Configurações salvas com sucesso!
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button id="save-notifications-btn" type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
