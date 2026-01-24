
import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '../components/Header';
import Chats from './chats/Chats';
import Contacts from './contacts/Contacts';
import Search from './search/Search';
import Bots from './Bots';
import Profile from './Profile';
import Settings from './Settings';
import Feedback from './Feedback';
import Admin from './admin/Admin';
import JoinChat from './JoinChat';
import Servers from './servers/Servers';
import ServerView from './servers/ServerView';
import JoinServer from './servers/JoinServer';
import Stories from '../components/Stories';
import { api } from '../services/api';
import { setupPush } from '../services/push';
import { ToastContainer, useToast } from '../components/Toast';
import { useStore } from '../store/useStore';
import { initAppearance } from '../services/appearance';
import ConnectionStatus from '../components/ConnectionStatus';

export default function AppShell() {
  const { user, setUser, setToken, setTheme, ui } = useStore();
  const [showStories, setShowStories] = useState(false);
  const nav = useNavigate();
  const { toasts, removeToast } = useToast();

  useEffect(() => {
    // Применяем сохраненную тему
    document.documentElement.setAttribute('data-theme', ui.theme);
    
    // Инициализируем темы и настройки внешнего вида
    initAppearance();
  }, [ui.theme]);

  useEffect(() => {
    // Загружаем данные пользователя только при монтировании
    const token = localStorage.getItem('token');
    if (!token) {
      nav('/login');
      return;
    }

    // Если пользователь уже загружен, не делаем повторный запрос
    if (user) {
      setupPush().catch(()=>{});
      return;
    }

    let cancelled = false;
    api('/api/users/me').then(u => { 
      if (!cancelled) {
        setUser(u); 
      }
    }).catch((err: any) => {
      if (cancelled) return;
      
      // Перенаправляем на логин только при ошибке авторизации (401/403)
      const status = err.status;
      const errorCode = err.errorCode || '';
      const errorMsg = err.message?.toLowerCase() || '';
      
      // Проверяем статус код или код ошибки
      if (status === 401 || status === 403 || 
          errorCode === 'unauthorized' || 
          errorMsg.includes('авторизац') || 
          errorMsg.includes('unauthorized') || 
          errorMsg.includes('forbidden') ||
          errorMsg.includes('токен')) {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        nav('/login');
      } else {
        // Для других ошибок (сеть, сервер и т.д.) просто логируем, но не перенаправляем
        console.warn('Failed to load user, but not redirecting:', err.message);
      }
    });
    setupPush().catch(()=>{});
    
    return () => {
      cancelled = true;
    };
  }, []); // Пустой массив зависимостей - выполняется только при монтировании

  const logout = () => { 
    setToken(null);
    setUser(null);
    nav('/login');
  };

  return (
    <motion.div 
      data-theme={ui.theme}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <Header user={user} onLogout={logout} />
      <motion.div 
        className="header" 
        style={{ padding: 'var(--spacing-md) var(--spacing-lg)', borderTop: '1px solid var(--border-color)' }}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 30 }}
      >
        <nav style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link to="/app/chats" className="btn btn-ghost" style={{ textDecoration: 'none' }}>💬 Чаты</Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link to="/app/servers" className="btn btn-ghost" style={{ textDecoration: 'none' }}>🖥️ Серверы</Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link to="/app/contacts" className="btn btn-ghost" style={{ textDecoration: 'none' }}>👥 Контакты</Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link to="/app/search" className="btn btn-ghost" style={{ textDecoration: 'none' }}>🔍 Поиск</Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link to="/app/bots" className="btn btn-ghost" style={{ textDecoration: 'none' }}>🤖 Боты</Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link to="/app/profile" className="btn btn-ghost" style={{ textDecoration: 'none' }}>👤 Профиль</Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link to="/app/settings" className="btn btn-ghost" style={{ textDecoration: 'none' }}>⚙️ Настройки</Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link to="/app/feedback" className="btn btn-ghost" style={{ textDecoration: 'none' }}>💭 Feedback</Link>
          </motion.div>
          <motion.button
            onClick={() => setShowStories(true)}
            className="btn btn-ghost"
            style={{ textDecoration: 'none', border: 'none', background: 'transparent', cursor: 'pointer' }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            📸 Истории
          </motion.button>
          {(() => {
            if (!user) {
              return null;
            }
            // Явная обработка ролей - сервер всегда отправляет массив
            let roles: string[] = [];
            const u: any = user as any;
            if (Array.isArray(u.roles)) {
              roles = u.roles;
            } else if (u.roles) {
              // Если пришла строка, разбиваем по запятой
              roles = String(u.roles).split(',').map(r => r.trim()).filter(r => r);
            }
            const hasAccess = roles.includes('admin') || roles.includes('owner');
            return hasAccess && (
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link to="/app/admin" className="btn btn-secondary" style={{ textDecoration: 'none' }}>⚙️ Панель управления</Link>
              </motion.div>
            );
          })()}
        </nav>
      </motion.div>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<Navigate to="/app/chats" replace />} />
          <Route path="chats" element={<Chats />} />
          <Route path="join/:link" element={<JoinChat />} />
          <Route path="servers" element={<Servers />} />
          <Route path="servers/join/:link" element={<JoinServer />} />
          <Route path="servers/:id" element={<ServerView />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="search" element={<Search />} />
          <Route path="bots" element={<Bots />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />} />
          <Route path="feedback" element={<Feedback />} />
          <Route path="admin" element={<Admin />} />
        </Routes>
      </AnimatePresence>
      <AnimatePresence>
        {showStories && (
          <Stories onClose={() => setShowStories(false)} />
        )}
      </AnimatePresence>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <ConnectionStatus />
    </motion.div>
  );
}
