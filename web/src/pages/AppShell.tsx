
import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Chats from './chats/Chats';
import Contacts from './contacts/Contacts';
import Search from './search/Search';
import Bots from './Bots';
import Profile from './Profile';
import Settings from './Settings';
import Feedback from './Feedback';
import Admin from './admin/Admin';
import Servers from './servers/Servers';
import ServerView from './servers/ServerView';
import Stories from '../components/Stories';
import { api } from '../services/api';
import { setupPush } from '../services/push';
import { ToastContainer, useToast } from '../components/Toast';

export default function AppShell() {
  const [user, setUser] = useState<any>(null);
  const [showStories, setShowStories] = useState(false);
  const nav = useNavigate();
  const { toasts, removeToast } = useToast();

  useEffect(() => {
    // Применяем сохраненную тему
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    api('/api/users/me').then(u => { 
      setUser(u); 
    }).catch((err) => {
      nav('/login');
    });
    setupPush().catch(()=>{});
  }, [nav]);

  const logout = () => { localStorage.removeItem('token'); location.href = '/'; };

  return (
    <div data-theme={localStorage.getItem('theme') || 'dark'}>
      <Header user={user} onLogout={logout} />
      <div className="header" style={{ padding: 'var(--spacing-md) var(--spacing-lg)', borderTop: '1px solid var(--border-color)' }}>
        <nav style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
          <Link to="/app/chats" className="btn btn-ghost" style={{ textDecoration: 'none' }}>💬 Чаты</Link>
          <Link to="/app/servers" className="btn btn-ghost" style={{ textDecoration: 'none' }}>🖥️ Серверы</Link>
          <Link to="/app/contacts" className="btn btn-ghost" style={{ textDecoration: 'none' }}>👥 Контакты</Link>
          <Link to="/app/search" className="btn btn-ghost" style={{ textDecoration: 'none' }}>🔍 Поиск</Link>
          <Link to="/app/bots" className="btn btn-ghost" style={{ textDecoration: 'none' }}>🤖 Боты</Link>
          <Link to="/app/profile" className="btn btn-ghost" style={{ textDecoration: 'none' }}>👤 Профиль</Link>
          <Link to="/app/settings" className="btn btn-ghost" style={{ textDecoration: 'none' }}>⚙️ Настройки</Link>
          <Link to="/app/feedback" className="btn btn-ghost" style={{ textDecoration: 'none' }}>💭 Feedback</Link>
          <button
            onClick={() => setShowStories(true)}
            className="btn btn-ghost"
            style={{ textDecoration: 'none', border: 'none', background: 'transparent', cursor: 'pointer' }}
          >
            📸 Истории
          </button>
          {(() => {
            if (!user) {
              return null;
            }
            // Явная обработка ролей - сервер всегда отправляет массив
            let roles: string[] = [];
            if (Array.isArray(user.roles)) {
              roles = user.roles;
            } else if (user.roles) {
              // Если пришла строка, разбиваем по запятой
              roles = String(user.roles).split(',').map(r => r.trim()).filter(r => r);
            }
            const hasAccess = roles.includes('admin') || roles.includes('owner');
            return hasAccess && (
              <Link to="/app/admin" className="btn btn-secondary" style={{ textDecoration: 'none' }}>⚙️ Панель управления</Link>
            );
          })()}
        </nav>
      </div>
      <Routes>
        <Route path="/" element={<Chats />} />
        <Route path="chats" element={<Chats />} />
        <Route path="servers" element={<Servers />} />
        <Route path="servers/:id" element={<ServerView />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="search" element={<Search />} />
        <Route path="bots" element={<Bots />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="feedback" element={<Feedback />} />
        <Route path="admin" element={<Admin />} />
      </Routes>
      {showStories && (
        <Stories onClose={() => setShowStories(false)} />
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
