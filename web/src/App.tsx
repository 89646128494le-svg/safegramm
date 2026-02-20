import React, { useEffect, useRef, useState, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { api, setOnUnauthorized } from './services/api';
import { useStore } from './store/useStore';
import ErrorBoundary from './components/ErrorBoundary';
import Landing from './pages/Landing';
import AppShell from './pages/AppShell';
import PublicProfile from './pages/PublicProfile';

const Features = lazy(() => import('./pages/Features'));
const Pricing = lazy(() => import('./pages/Pricing'));
const About = lazy(() => import('./pages/About'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));

const LOAD_TIMEOUT_MS = 12000;

const ROUTE_TITLES: Record<string, string> = {
  '/': 'SafeGram — Безопасный мессенджер',
  '/features': 'Функции — SafeGram',
  '/pricing': 'Тарифы — SafeGram',
  '/about': 'О нас — SafeGram',
  '/privacy': 'Приватность — SafeGram',
  '/terms': 'Условия — SafeGram',
  '/login': 'Вход — SafeGram',
  '/register': 'Регистрация — SafeGram',
  '/app/chats': 'Чаты — SafeGram',
  '/app/contacts': 'Контакты — SafeGram',
  '/app/servers': 'Серверы — SafeGram',
  '/app/settings': 'Настройки — SafeGram',
  '/app/premium': 'Тарифы — SafeGram',
  '/app/profile': 'Профиль — SafeGram',
  '/app/reports': 'Жалобы — SafeGram',
  '/app/admin': 'Админ-панель — SafeGram',
};

function PageFallback() {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);
  if (timedOut) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24, background: 'linear-gradient(135deg, #0b1020 0%, #1a1f35 100%)', color: '#e2e8f0', fontFamily: 'system-ui' }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🔒</div>
        <p style={{ margin: 0, fontWeight: 600 }}>Загрузка занимает больше обычного</p>
        <p style={{ margin: 0, fontSize: 14, color: '#94a3b8' }}>Проверьте интернет и обновите страницу</p>
        <button type="button" onClick={() => window.location.reload()} style={{ padding: '12px 24px', background: '#7c6cff', border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Обновить</button>
      </div>
    );
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'linear-gradient(135deg, #0b1020 0%, #1a1f35 100%)' }}>
      <div style={{ width: 32, height: 32, border: '3px solid rgba(124,108,255,0.25)', borderTopColor: '#7c6cff', borderRadius: '50%', animation: 'sg-spin 0.8s linear infinite' }} />
      <span style={{ fontSize: 14, color: 'rgba(233,236,245,0.6)' }}>Загрузка...</span>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const { token, setToken, setUser, user } = useStore();
  const authChecked = useRef(false);

  useEffect(() => {
    const path = location.pathname;
    const title = ROUTE_TITLES[path] || (path.startsWith('/app') ? 'SafeGram' : 'SafeGram — Безопасный мессенджер');
    document.title = title;
  }, [location.pathname]);

  useEffect(() => {
    setOnUnauthorized(() => {
      setToken(null);
      setUser(null);
      if (typeof localStorage !== 'undefined') localStorage.removeItem('token');
    });
    return () => setOnUnauthorized(null);
  }, [setToken, setUser]);

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
        <Route path="/u/:username" element={<PublicProfile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
