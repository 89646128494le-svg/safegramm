import React, { useEffect, useRef, useState, Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { api } from './services/api';
import { useStore } from './store/useStore';
import ErrorBoundary from './components/ErrorBoundary';
import Landing from './pages/Landing';
import AppShell from './pages/AppShell';

const Features = lazy(() => import('./pages/Features'));
const Pricing = lazy(() => import('./pages/Pricing'));
const About = lazy(() => import('./pages/About'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));

const LOAD_TIMEOUT_MS = 12000;

function PageFallback() {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);
  if (timedOut) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, background: 'linear-gradient(135deg, #0b1020 0%, #1a1f35 100%)', color: '#e2e8f0', fontFamily: 'system-ui' }}>
        <p style={{ margin: 0, textAlign: 'center' }}>Загрузка занимает больше обычного.</p>
        <p style={{ margin: 0, fontSize: 14, color: '#94a3b8' }}>Проверьте интернет и обновите страницу.</p>
        <button type="button" onClick={() => window.location.reload()} style={{ padding: '10px 20px', background: '#7c6cff', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 14 }}>Обновить</button>
      </div>
    );
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0b1020 0%, #1a1f35 100%)' }}>
      <div style={{ width: 24, height: 24, border: '2px solid rgba(124,108,255,0.3)', borderTopColor: '#7c6cff', borderRadius: '50%', animation: 'sg-spin 0.7s linear infinite' }} />
    </div>
  );
}

export default function App() {
  const { token, setToken, setUser, user } = useStore();
  const authChecked = useRef(false);

  useEffect(() => {
    if (authChecked.current) return;
    authChecked.current = true;
    const t = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null);
    if (!t) {
      setUser(null);
      return;
    }
    api('/api/users/me')
      .then((userData) => {
        setToken(t);
        setUser(userData);
      })
      .catch((err: any) => {
        const status = err?.status;
        const code = err?.errorCode || '';
        const msg = (err?.message || '').toLowerCase();
        if (status === 401 || status === 403 || code === 'unauthorized' || msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('авторизац') || msg.includes('токен')) {
          setToken(null);
          setUser(null);
        }
      });
  }, [token, setToken, setUser]);

  const handleAuthSuccess = () => {
    const t = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    if (t) {
      api('/api/users/me').then((userData) => { setToken(t); setUser(userData); }).catch(() => { setToken(null); setUser(null); });
    }
  };

  const isAuthenticated = !!(token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null));

  return (
    <ErrorBoundary>
      <Suspense fallback={<PageFallback />}>
        <Routes>
        <Route path="/" element={
          isAuthenticated ? <Navigate to="/app/chats" replace /> : <Landing />
        } />
        <Route path="/app/*" element={
          isAuthenticated ? <AppShell /> : <Navigate to="/login" replace />
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
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
