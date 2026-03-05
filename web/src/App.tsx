import React, { useEffect, useRef, useState, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { api } from './services/api';
import { useStore } from './store/useStore';
import ErrorBoundary from './components/ErrorBoundary';
import MaintenanceBanner from './components/MaintenanceBanner';
import DesktopTitlebar, { DESKTOP_TITLEBAR_HEIGHT } from './components/DesktopTitlebar';
import Landing from './pages/Landing';
import AppShell from './pages/AppShell';

const Features = lazy(() => import('./pages/Features'));
const Pricing = lazy(() => import('./pages/Pricing'));
const About = lazy(() => import('./pages/About'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const PremiumApply = lazy(() => import('./pages/PremiumApply'));
const JoinRecruit = lazy(() => import('./pages/JoinRecruit'));
const InvitePage = lazy(() => import('./pages/InvitePage'));

const LOAD_TIMEOUT_MS = 12000;

function PageFallback() {
  const [timedOut, setTimedOut] = useState(false);
  const navigate = useNavigate();
  const isDesktop = typeof window !== 'undefined' && !!(window as any).electronAPI;
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);
  if (timedOut) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, background: 'linear-gradient(135deg, #0b1020 0%, #1a1f35 100%)', color: '#e2e8f0', fontFamily: 'system-ui' }}>
        <p style={{ margin: 0, textAlign: 'center' }}>Загрузка занимает больше обычного.</p>
        <p style={{ margin: 0, fontSize: 14, color: '#94a3b8' }}>Проверьте интернет.</p>
        <button type="button" onClick={() => isDesktop ? navigate('/login') : window.location.reload()} style={{ padding: '10px 20px', background: '#7c6cff', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 14 }}>{isDesktop ? 'На экран входа' : 'Обновить'}</button>
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
  const navigate = useNavigate();
  const [errorBoundaryKey, setErrorBoundaryKey] = useState(0);
  const handleErrorRetry = () => {
    setErrorBoundaryKey((k) => k + 1);
    navigate('/login');
  };
  const { token, setToken, setUser, user } = useStore();
  const authChecked = useRef(false);
  const hasStoredToken = !!(token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null));
  const [authCheckDone, setAuthCheckDone] = useState(!hasStoredToken);

  useEffect(() => {
    if (authChecked.current) return;
    const t = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null);
    if (!t) {
      setUser(null);
      setAuthCheckDone(true);
      authChecked.current = true;
      return;
    }
    authChecked.current = true;
    const isDesktop = typeof window !== 'undefined' && !!(window as any).electronAPI;
    const AUTH_TIMEOUT_MS = isDesktop ? 6000 : 12000;
    const timeoutId = setTimeout(() => {
      setAuthCheckDone(true);
      setToken(null);
      setUser(null);
      if (typeof localStorage !== 'undefined') localStorage.removeItem('token');
    }, AUTH_TIMEOUT_MS);
    api('/api/users/me')
      .then((userData) => {
        clearTimeout(timeoutId);
        setToken(t);
        setUser(userData);
        setAuthCheckDone(true);
      })
      .catch((err: any) => {
        clearTimeout(timeoutId);
        const status = err?.status;
        const code = err?.errorCode || '';
        const msg = (err?.message || '').toLowerCase();
        if (status === 401 || status === 403 || code === 'unauthorized' || msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('авторизац') || msg.includes('токен')) {
          setToken(null);
          setUser(null);
          if (typeof localStorage !== 'undefined') localStorage.removeItem('token');
        }
        setAuthCheckDone(true);
      });
  }, [token, setToken, setUser]);

  const handleAuthSuccess = () => {
    const t = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    if (t) {
      api('/api/users/me').then((userData) => { setToken(t); setUser(userData); }).catch(() => { setToken(null); setUser(null); });
    }
  };

  const isAuthenticated = !!user;
  const checkingAuth = hasStoredToken && !authCheckDone;

  if (checkingAuth) {
    return (
      <ErrorBoundary>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, background: 'linear-gradient(135deg, #0b1020 0%, #1a1f35 100%)', color: '#e2e8f0', fontFamily: 'system-ui' }}>
          <div style={{ width: 28, height: 28, border: '2px solid rgba(124,108,255,0.3)', borderTopColor: '#7c6cff', borderRadius: '50%', animation: 'sg-spin 0.7s linear infinite' }} />
          <p style={{ margin: 0, fontSize: 15 }}>Проверка входа...</p>
        </div>
      </ErrorBoundary>
    );
  }

  const isDesktop = typeof window !== 'undefined' && !!(window as any).electronAPI;

  // Десктоп: только мессенджер — вход/регистрация → чаты/админка, без лендинга
  if (isDesktop) {
    return (
      <ErrorBoundary key={errorBoundaryKey} onRetry={handleErrorRetry}>
        <DesktopTitlebar />
        <div style={{ paddingTop: DESKTOP_TITLEBAR_HEIGHT, minHeight: '100vh' }}>
          <MaintenanceBanner />
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={
                isAuthenticated ? <Navigate to="/app/chats" replace /> : <Navigate to="/login" replace />
              } />
              <Route path="/app/*" element={
                isAuthenticated ? <AppShell /> : <Navigate to="/login" replace />
              } />
              <Route path="/login" element={
                isAuthenticated ? <Navigate to="/app/chats" replace /> : <Login onDone={handleAuthSuccess} />
              } />
              <Route path="/register" element={
                isAuthenticated ? <Navigate to="/app/chats" replace /> : <Register />
              } />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/premium-apply" element={isAuthenticated ? <PremiumApply /> : <Navigate to="/login" replace />} />
              <Route path="/join" element={isAuthenticated ? <JoinRecruit /> : <Navigate to="/login" replace />} />
              <Route path="/invite/:code" element={<InvitePage />} />
              <Route path="*" element={<Navigate to={isAuthenticated ? '/app/chats' : '/login'} replace />} />
            </Routes>
          </Suspense>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary key={errorBoundaryKey} onRetry={handleErrorRetry}>
      <MaintenanceBanner />
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
        <Route path="/premium-apply" element={<PremiumApply />} />
        <Route path="/join" element={<JoinRecruit />} />
        <Route path="/invite/:code" element={<InvitePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
