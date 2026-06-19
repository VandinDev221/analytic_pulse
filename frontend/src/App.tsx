import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MonitorDetailPage } from './pages/MonitorDetailPage';
import { StatusPage } from './pages/StatusPage';
import { AppLayout } from './components/AppLayout';
import { getMe } from './services/api';

function App() {
  const [user, setUser] = useState<{ id: string; email: string; slug: string } | null>(null);
  const [loading, setLoading] = useState(true);

  async function checkAuth() {
    const token = localStorage.getItem('pingpulse_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const userData = await getMe();
      setUser(userData);
    } catch {
      // Token is invalid or expired, clear it
      localStorage.removeItem('pingpulse_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkAuth();
    
    // Listen for custom auth state changes
    const handleAuthChange = () => {
      checkAuth();
    };
    window.addEventListener('auth-state-change', handleAuthChange);
    return () => window.removeEventListener('auth-state-change', handleAuthChange);
  }, []);

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

  const userSlug = user?.slug || '';

  return (
    <BrowserRouter>
      <Routes>
        {/* Public status page — no auth required */}
        <Route path="/status/:slug" element={<StatusPage />} />

        {/* Auth page */}
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <LoginPage />}
        />

        {/* Protected app routes */}
        <Route
          path="/"
          element={
            user
              ? <AppLayout userSlug={userSlug}><DashboardPage /></AppLayout>
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/monitors/:id"
          element={
            user
              ? <AppLayout userSlug={userSlug}><MonitorDetailPage /></AppLayout>
              : <Navigate to="/login" replace />
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
