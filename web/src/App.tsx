
import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Landing from './pages/Landing';
import Features from './pages/Features';
import Pricing from './pages/Pricing';
import About from './pages/About';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Login from './pages/Login';
import Register from './pages/Register';
import AppShell from './pages/AppShell';
import { api } from './services/api';
import { useStore } from './store/useStore';

export default function App() {
  const [ready, setReady] = useState(false);
  const { token, setToken, setUser, user } = useStore();
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  const checkAuth = async () => {
    const t = token || localStorage.getItem('token');
    if (t) {
      try {
        // Проверяем валидность токена через API
        const userData = await api('/api/users/me');
        setToken(t);
        setUser(userData);
      } catch (err: any) {
        // Токен невалидный только при ошибке авторизации
        const status = err.status;
        const errorCode = err.errorCode || '';
        const errorMsg = err.message?.toLowerCase() || '';
        
        if (status === 401 || status === 403 || 
            errorCode === 'unauthorized' || 
            errorMsg.includes('авторизац') || 
            errorMsg.includes('unauthorized') || 
            errorMsg.includes('forbidden')) {
          // Токен невалидный, удаляем его
          setToken(null);
          setUser(null);
        } else {
          // Для других ошибок (сеть, сервер) оставляем пользователя, если он уже был загружен
          if (!user) {
            setUser(null);
          }
        }
      }
    } else {
      setUser(null);
    }
    setAccepted(localStorage.getItem('policiesAccepted') === '1');
    setChecking(false);
    setReady(true);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Функция для обновления авторизации (передается в Login)
  const handleAuthSuccess = () => {
    checkAuth();
  };

  if (!ready || checking) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ 
          minHeight: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0b1020 0%, #1a1f35 100%)',
          color: '#e2e8f0'
        }}
      >
        <motion.div
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.5, 1, 0.5]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          Загрузка...
        </motion.div>
      </motion.div>
    );
  }

  // Если пользователь авторизован, редиректим с главной страницы в мессенджер
  const isAuthenticated = !!user && !!token;
  
  return (
    <Routes>
      {/* Главная страница - редирект в мессенджер если авторизован */}
      <Route path="/" element={
        isAuthenticated ? <Navigate to="/app/chats" replace /> : <Landing />
      } />
      <Route path="/features" element={<Features />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/about" element={<About />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      {/* Login/Register - редирект в мессенджер если уже авторизован */}
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
  );
}
