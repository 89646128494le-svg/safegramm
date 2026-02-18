/**
 * AppShell - Главная оболочка приложения с навигацией
 */

import { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import WebSocketManager from '../core/websocket/manager';
import { apiClient } from '../core/api/client';
import Chats from './chats/Chats';
import Settings from './Settings';
import Profile from './Profile';
import Search from './Search';
import Contacts from './Contacts';
import Admin from './Admin';
import Bots from './Bots';
import ServerView from './ServerView';
import JoinServer from './JoinServer';
import JoinChat from './JoinChat';
import Feedback from './Feedback';
import Stories from '../components/Stories';
import './AppShell.css';

interface AppShellProps {
  user: any;
  onLogout: () => void;
  wsManager: WebSocketManager | null;
}

export default function AppShell({ user, onLogout, wsManager }: AppShellProps) {
  const [showStories, setShowStories] = useState(false);
  const nav = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Применяем сохраненную тему
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Интеграция с Electron для уведомлений
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const electronAPI = (window as any).electronAPI;

      // Обработка навигации из трея
      electronAPI.on('navigate', (path: string) => {
        nav(path);
      });

      // Обработка горячих клавиш
      electronAPI.on('toggle-mute', () => {
        // TODO: Переключение звука в звонках
      });
    }
  }, [nav]);

  // Синхронизация статуса онлайн/офлайн при фокусе и сворачивании окна
  useEffect(() => {
    if (!user) return;

    const setStatus = (status: 'online' | 'offline' | 'away') => {
      apiClient.post('/api/users/me/status', { status }).catch(() => {});
    };

    if (document.visibilityState === 'visible') {
      setStatus('online');
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setStatus('online');
      } else {
        setStatus('away');
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user]);

  // Проверка прав доступа
  const hasAdminAccess = () => {
    if (!user) return false;
    const roles = Array.isArray(user.roles) 
      ? user.roles 
      : (user.roles ? String(user.roles).split(',').map((r: string) => r.trim()) : []);
    return roles.includes('admin') || roles.includes('owner');
  };

  const handleLogout = () => {
    apiClient.setToken(null);
    onLogout();
  };

  return (
    <div className="app-shell" data-theme={localStorage.getItem('theme') || 'dark'}>
      <div className="app-header">
        <div className="app-header-content">
          <h1 className="app-title">SafeGram</h1>
          <div className="app-user-info">
            {user && (
              <>
                <span className="app-username">{user.username}</span>
                {user.avatarUrl && (
                  <img src={user.avatarUrl} alt={user.username} className="app-avatar" />
                )}
              </>
            )}
            <button onClick={handleLogout} className="btn btn-ghost btn-sm">
              Выход
            </button>
          </div>
        </div>
      </div>

      <nav className="app-nav">
        <Link 
          to="/chats" 
          className={`nav-link ${location.pathname === '/chats' || location.pathname === '/' ? 'active' : ''}`}
        >
          💬 Чаты
        </Link>
        <Link to="/join" className={`nav-link ${location.pathname === '/join' ? 'active' : ''}`}>
          ➕ В чат по ссылке
        </Link>
        <Link 
          to="/servers" 
          className={`nav-link ${location.pathname.startsWith('/servers') ? 'active' : ''}`}
        >
          🖥️ Серверы
        </Link>
        <Link to="/servers/join" className={`nav-link ${location.pathname === '/servers/join' ? 'active' : ''}`}>
          ➕ В сервер по ссылке
        </Link>
        <Link 
          to="/contacts" 
          className={`nav-link ${location.pathname === '/contacts' ? 'active' : ''}`}
        >
          👥 Контакты
        </Link>
        <Link 
          to="/search" 
          className={`nav-link ${location.pathname === '/search' ? 'active' : ''}`}
        >
          🔍 Поиск
        </Link>
        <Link 
          to="/bots" 
          className={`nav-link ${location.pathname === '/bots' ? 'active' : ''}`}
        >
          🤖 Боты
        </Link>
        <Link 
          to="/profile" 
          className={`nav-link ${location.pathname === '/profile' ? 'active' : ''}`}
        >
          👤 Профиль
        </Link>
        <Link 
          to="/settings" 
          className={`nav-link ${location.pathname === '/settings' ? 'active' : ''}`}
        >
          ⚙️ Настройки
        </Link>
        <Link 
          to="/feedback" 
          className={`nav-link ${location.pathname === '/feedback' ? 'active' : ''}`}
        >
          💭 Feedback
        </Link>
        <button
          onClick={() => setShowStories(true)}
          className="nav-link nav-button"
        >
          📸 Истории
        </button>
        {hasAdminAccess() && (
          <Link 
            to="/admin" 
            className={`nav-link nav-link-admin ${location.pathname === '/admin' ? 'active' : ''}`}
          >
            ⚙️ Панель управления
          </Link>
        )}
      </nav>

      <div className="app-content">
        <Routes>
          <Route path="/" element={<Chats wsManager={wsManager} user={user} />} />
          <Route path="/chats" element={<Chats wsManager={wsManager} user={user} />} />
          <Route path="/servers" element={<ServerView wsManager={wsManager} user={user} />} />
          <Route path="/servers/join" element={<JoinServer />} />
          <Route path="/servers/:id" element={<ServerView wsManager={wsManager} user={user} />} />
          <Route path="/join" element={<JoinChat />} />
          <Route path="/contacts" element={<Contacts wsManager={wsManager} user={user} />} />
          <Route path="/search" element={<Search wsManager={wsManager} user={user} />} />
          <Route path="/bots" element={<Bots wsManager={wsManager} user={user} />} />
          <Route path="/profile" element={<Profile user={user} />} />
          <Route path="/settings" element={<Settings user={user} />} />
          <Route path="/feedback" element={<Feedback user={user} />} />
          <Route path="/admin" element={<Admin user={user} />} />
        </Routes>
      </div>

      {showStories && (
        <Stories onClose={() => setShowStories(false)} />
      )}
    </div>
  );
}
