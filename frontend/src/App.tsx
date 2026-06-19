import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MonitorDetailPage } from './pages/MonitorDetailPage';
import { StatusPage } from './pages/StatusPage';
import { AppLayout } from './components/AppLayout';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userSlug, setUserSlug] = useState('');

  useEffect(() => {
    // Restore existing session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadSlug(data.session.user.id);
      setLoading(false);
    });

    // Listen for auth changes (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) loadSlug(session.user.id);
      else setUserSlug('');
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadSlug(userId: string) {
    const { data } = await supabase.from('profiles').select('slug').eq('user_id', userId).single();
    if (data?.slug) setUserSlug(data.slug);
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', flexDirection: 'column', gap: 16,
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 24px rgba(99,102,241,0.4)',
          animation: 'pulse-ring 1.5s ease-out infinite',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Carregando PingPulse...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public status page — no auth required */}
        <Route path="/status/:slug" element={<StatusPage />} />

        {/* Auth page */}
        <Route
          path="/login"
          element={session ? <Navigate to="/" replace /> : <LoginPage />}
        />

        {/* Protected app routes */}
        <Route
          path="/"
          element={
            session
              ? <AppLayout userSlug={userSlug}><DashboardPage /></AppLayout>
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/monitors/:id"
          element={
            session
              ? <AppLayout userSlug={userSlug}><MonitorDetailPage /></AppLayout>
              : <Navigate to="/login" replace />
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to={session ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
