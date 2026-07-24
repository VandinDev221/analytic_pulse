import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MonitorDetailPage } from './pages/MonitorDetailPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { IncidentDetailPage } from './pages/IncidentDetailPage';
import { AlertsPage } from './pages/AlertsPage';
import { StatusPageSettingsPage } from './pages/StatusPageSettingsPage';
import { MapPage } from './pages/MapPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SslPage } from './pages/SslPage';
import { DnsPage } from './pages/DnsPage';
import { AgentsPage } from './pages/AgentsPage';
import { AgentDetailPage } from './pages/AgentDetailPage';
import { DockerPage } from './pages/DockerPage';
import { KubernetesPage } from './pages/KubernetesPage';
import { ApiKeysPage } from './pages/ApiKeysPage';
import { DocsPage } from './pages/DocsPage';
import { RumPage } from './pages/RumPage';
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
        <Route
          path="/incidents"
          element={
            user
              ? <AppLayout userSlug={userSlug}><IncidentsPage /></AppLayout>
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/incidents/:id"
          element={
            user
              ? <AppLayout userSlug={userSlug}><IncidentDetailPage /></AppLayout>
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/alerts"
          element={
            user
              ? <AppLayout userSlug={userSlug}><AlertsPage /></AppLayout>
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/agents"
          element={
            user
              ? <AppLayout userSlug={userSlug}><AgentsPage /></AppLayout>
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/agents/:id"
          element={
            user
              ? <AppLayout userSlug={userSlug}><AgentDetailPage /></AppLayout>
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/docker"
          element={
            user
              ? <AppLayout userSlug={userSlug}><DockerPage /></AppLayout>
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/kubernetes"
          element={
            user
              ? <AppLayout userSlug={userSlug}><KubernetesPage /></AppLayout>
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/api-keys"
          element={
            user
              ? <AppLayout userSlug={userSlug}><ApiKeysPage /></AppLayout>
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/dns"
          element={
            user
              ? <AppLayout userSlug={userSlug}><DnsPage /></AppLayout>
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/ssl"
          element={
            user
              ? <AppLayout userSlug={userSlug}><SslPage /></AppLayout>
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/analytics"
          element={
            user
              ? <AppLayout userSlug={userSlug}><AnalyticsPage /></AppLayout>
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/map"
          element={
            user
              ? <AppLayout userSlug={userSlug}><MapPage /></AppLayout>
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/docs"
          element={
            user
              ? <AppLayout userSlug={userSlug}><DocsPage /></AppLayout>
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/rum"
          element={
            user
              ? <AppLayout userSlug={userSlug}><RumPage /></AppLayout>
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/status-page"
          element={
            user
              ? <AppLayout userSlug={userSlug}><StatusPageSettingsPage /></AppLayout>
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
