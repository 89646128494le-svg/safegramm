import React, { useEffect, useState, Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { api } from './services/api';
import { useStore } from './store/useStore';
import ErrorBoundary from './components/ErrorBoundary';

const Landing = lazy(() => import('./pages/Landing'));
const Features = lazy(() => import('./pages/Features'));
const Pricing = lazy(() => import('./pages/Pricing'));
const About = lazy(() => import('./pages/About'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const AppShell = lazy(() => import('./pages/AppShell'));

const PageFallback = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
    <span style={{ color: 'var(--text-secondary)' }}>Загрузка...</span>
  </div>
);

export default function App() {
  const { token, setToken, setUser, user } = useStore();
  const [authChecking, setAuthChecking] = useState(true);

  const checkAuth = async () => {
    const t = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null);
    if (!t) {
      setUser(null);
      setAuthChecking(false);
      return;
    }
    try {
      const userData = await api('/api/users/me');
      setToken(t);
      setUser(userData);
    } catch (err: any) {
      const status = err?.status;
      const code = err?.errorCode || '';
      const msg = (err?.message || '').toLowerCase();
      if (status === 401 || status === 403 || code === 'unauthorized' || msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('авторизац')) {
        setToken(null);
        setUser(null);
      } else if (!user) {
        setUser(null);
      }
    } finally {
      setAuthChecking(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleAuthSuccess = () => {
    checkAuth();
  };

  const isAuthenticated = !!user && !!token;

  if (authChecking) {
    return <PageFallback />;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<PageFallback />}>
        <Routes>
        <Route path="/" element={
          isAuthenticated ? <Navigate to="/app/chats" replace /> : <Landing />
        } />
        <Route path="/features" element={<Features />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/about" element={<About />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/app/chats" replace /> : <Login onDone={handleAuthSuccess} />
        } />
        <Route path="/register" element={
          isAuthenticated ? <Navigate to="/app/chats" replace /> : <Register />
        } />
        <Route path="/app/*" element={
          isAuthenticated ? <AppShell /> : <Navigate to="/login" replace />
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
