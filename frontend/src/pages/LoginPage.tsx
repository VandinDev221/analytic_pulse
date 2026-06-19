import React, { useState } from 'react';
import { login, signup } from '../services/api';
import { Activity, Mail, Lock, ArrowRight, Zap } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        await signup(email, password);
        setSuccess('Conta criada com sucesso! Redirecionando...');
      } else {
        await login(email, password);
      }
      
      // Notify authentication state change
      window.dispatchEvent(new Event('auth-state-change'));
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'var(--bg-base)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow blobs */}
      <div style={{ position: 'absolute', top: -200, left: -200, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -150, right: -150, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Left panel — Branding */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 80px',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.04) 0%, transparent 60%)',
        borderRight: '1px solid var(--border)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(99,102,241,0.4)',
          }}>
            <Activity size={22} color="#fff" />
          </div>
          <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Ping<span className="gradient-text">Pulse</span>
          </span>
        </div>

        <h1 style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.03em', marginBottom: 20 }}>
          Monitore seus<br />
          <span className="gradient-text">serviços em tempo real</span>
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 420, marginBottom: 48 }}>
          Alertas instantâneos via Telegram, gráficos de latência, e uma página de status pública elegante — tudo gratuito.
        </p>

        {/* Feature list */}
        {[
          { icon: '🟢', text: 'Grid de 90 dias de uptime estilo GitHub' },
          { icon: '⚡', text: 'Pings a cada 1 minuto com detecção imediata' },
          { icon: '🤖', text: 'Alertas no Telegram quando um serviço cair' },
          { icon: '📈', text: 'Gráficos de latência histórica interativos' },
        ].map(f => (
          <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <span style={{ fontSize: 18 }}>{f.icon}</span>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{f.text}</span>
          </div>
        ))}
      </div>

      {/* Right panel — Auth form */}
      <div style={{
        width: 460,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 56px',
      }}>
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            {mode === 'login' ? 'Entrar na plataforma' : 'Criar sua conta'}
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            {mode === 'login' ? 'Novo por aqui? ' : 'Já tem conta? '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setSuccess(''); }}
              style={{ color: 'var(--accent-light)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, padding: 0 }}
            >
              {mode === 'login' ? 'Criar conta grátis' : 'Fazer login'}
            </button>
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">
              <Mail size={12} style={{ display: 'inline', marginRight: 4 }} />
              E-mail
            </label>
            <input
              className="input"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              id="email-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <Lock size={12} style={{ display: 'inline', marginRight: 4 }} />
              Senha
            </label>
            <input
              className="input"
              type="password"
              placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : '••••••••'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              id="password-input"
            />
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#4ade80' }}>
              {success}
            </div>
          )}

          <button
            id="auth-submit-btn"
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '12px 20px', marginTop: 4, fontSize: 15 }}
          >
            <Zap size={15} />
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            {!loading && <ArrowRight size={15} />}
          </button>
        </form>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 32, lineHeight: 1.6 }}>
          Ao continuar, você concorda com os nossos Termos de Serviço e Política de Privacidade.
        </p>
      </div>
    </div>
  );
};
