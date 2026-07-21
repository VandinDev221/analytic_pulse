import React, { useState, useEffect, useRef } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { login, sendSignupCode, verifySignup, loginWithGoogle, getAuthConfig } from '../services/api';
import { Activity, Mail, Lock, ArrowRight, Zap, KeyRound } from 'lucide-react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [signupStep, setSignupStep] = useState<'form' | 'verify'>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [googleEnabled, setGoogleEnabled] = useState(!!GOOGLE_CLIENT_ID);
  const [googleWidth, setGoogleWidth] = useState(320);
  const googleWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAuthConfig().then(cfg => {
      setGoogleEnabled(cfg.googleEnabled || !!GOOGLE_CLIENT_ID);
    });
  }, []);

  useEffect(() => {
    const el = googleWrapRef.current;
    if (!el) return;

    function updateWidth() {
      setGoogleWidth(Math.min(el!.clientWidth, 400));
    }

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, [googleEnabled, signupStep]);

  function resetSignup() {
    setSignupStep('form');
    setCode('');
    setError('');
    setSuccess('');
  }

  function switchMode(next: 'login' | 'signup') {
    setMode(next);
    resetSignup();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (signupStep === 'form') {
          const result = await sendSignupCode(email, password);
          setSignupStep('verify');
          setSuccess(
            result.devCode
              ? `Código enviado! (dev: ${result.devCode})`
              : 'Enviamos um código de 6 dígitos para o seu e-mail.'
          );
        } else {
          await verifySignup(email, code);
          setSuccess('Conta criada com sucesso! Redirecionando...');
          window.dispatchEvent(new Event('auth-state-change'));
        }
      } else {
        await login(email, password);
        window.dispatchEvent(new Event('auth-state-change'));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSuccess(credential?: string) {
    if (!credential) return;
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle(credential);
      window.dispatchEvent(new Event('auth-state-change'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao entrar com Google');
    } finally {
      setLoading(false);
    }
  }

  const formContent = (
    <>
      <header className="login-page__header">
        <div className="login-page__logo">
          <Activity size={20} color="#fff" />
        </div>
        <h1 className="login-page__title">
          {mode === 'login'
            ? 'Entrar'
            : signupStep === 'verify'
              ? 'Confirmar e-mail'
              : 'Criar conta'}
        </h1>
        <p className="login-page__subtitle">
          {mode === 'login' ? (
            <>
              Novo por aqui?{' '}
              <button type="button" onClick={() => switchMode('signup')} className="login-page__link">
                Criar conta
              </button>
            </>
          ) : signupStep === 'verify' ? (
            <>
              Não recebeu?{' '}
              <button
                type="button"
                onClick={() => { setSignupStep('form'); setSuccess(''); }}
                className="login-page__link"
              >
                Reenviar código
              </button>
            </>
          ) : (
            <>
              Já tem conta?{' '}
              <button type="button" onClick={() => switchMode('login')} className="login-page__link">
                Fazer login
              </button>
            </>
          )}
        </p>
      </header>

      {googleEnabled && GOOGLE_CLIENT_ID && signupStep === 'form' && (
        <>
          <div ref={googleWrapRef} className="login-page__google">
            <GoogleLogin
              onSuccess={res => handleGoogleSuccess(res.credential)}
              onError={() => setError('Falha ao entrar com Google')}
              theme="filled_black"
              size="large"
              width={String(googleWidth)}
              text={mode === 'login' ? 'signin_with' : 'signup_with'}
            />
          </div>
          <div className="login-page__divider">
            <span>ou com e-mail</span>
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="login-page__form">
        {signupStep === 'verify' ? (
          <>
            <p className="login-page__hint">
              Digite o código enviado para <strong>{email}</strong>
            </p>
            <div className="form-group">
              <label className="form-label">
                <KeyRound size={12} style={{ display: 'inline', marginRight: 4 }} />
                Código de verificação
              </label>
              <input
                className="input login-page__code-input"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoFocus
              />
            </div>
          </>
        ) : (
          <>
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
                autoFocus={mode === 'login'}
                autoComplete="email"
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
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                id="password-input"
              />
            </div>
          </>
        )}

        {error && <div className="login-page__alert login-page__alert--error">{error}</div>}
        {success && <div className="login-page__alert login-page__alert--success">{success}</div>}

        <button
          id="auth-submit-btn"
          type="submit"
          className="btn btn-primary login-page__submit"
          disabled={loading}
        >
          <Zap size={15} />
          {loading
            ? 'Aguarde...'
            : mode === 'login'
              ? 'Entrar'
              : signupStep === 'verify'
                ? 'Confirmar código'
                : 'Enviar código'}
          {!loading && <ArrowRight size={15} />}
        </button>
      </form>

      <p className="login-page__terms">
        Ao continuar, você concorda com os nossos Termos de Serviço e Política de Privacidade.
      </p>
    </>
  );

  return (
    <div className="login-page">
      <div className="login-page__glow login-page__glow--top" aria-hidden />
      <div className="login-page__glow login-page__glow--bottom" aria-hidden />

      <div className="login-page__card">
        {GOOGLE_CLIENT_ID ? (
          <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            {formContent}
          </GoogleOAuthProvider>
        ) : (
          formContent
        )}
      </div>
    </div>
  );
};
