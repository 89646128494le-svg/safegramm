
import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Login from './pages/Login';
import Register from './pages/Register';
import AppShell from './pages/AppShell';
import { api } from './services/api';

export default function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  const checkAuth = async () => {
    const t = localStorage.getItem('token');
    if (t) {
      try {
        // Проверяем валидность токена через API
        await api('/api/users/me');
        setAuthed(true);
      } catch {
        // Токен невалидный, удаляем его
        localStorage.removeItem('token');
        setAuthed(false);
      }
    } else {
      setAuthed(false);
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
    setAuthed(true);
  };

  if (!ready || checking) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0b1020 0%, #1a1f35 100%)',
        color: '#e2e8f0'
      }}>
        <div>Загрузка...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/login" element={<Login onDone={handleAuthSuccess} />} />
      <Route path="/register" element={<Register />} />
      <Route path="/app/*" element={
        accepted ? (authed ? <AppShell /> : <Navigate to="/login" />) : <Navigate to="/" />
      } />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
