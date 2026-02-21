import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
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
// Импортируем Safety Assistant
import SafetyAssistant from '../components/SafetyAssistant'; 
import { api } from '../services/api';
import { setupPush } from '../services/push';
import { ToastContainer, useToast } from '../components/Toast';
import { useStore } from '../store/useStore';
import { initAppearance } from '../services/appearance';
import ConnectionStatus from '../components/ConnectionStatus';
import IncomingCallNotification from '../components/IncomingCallNotification';
import DMCall from '../components/DMCall';
import MaintenanceBanner from '../components/MaintenanceBanner';
import ServerStrip from '../components/ServerStrip';
import { getSocket, sendWebSocketMessage } from '../services/websocket';

export default function AppShell() {
  const location = useLocation();
  const { user, setUser, setToken, setTheme, ui } = useStore();
  const showServerStrip = location.pathname === '/app' || location.pathname === '/app/chats' || location.pathname === '/app/servers' || location.pathname.startsWith('/app/servers/');
  const [showStories, setShowStories] = useState(false);
  // Состояние для отображения Safety Assistant
  const [showSafety, setShowSafety] = useState(false); 
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [activeCall, setActiveCall] = useState<any>(null);
  const nav = useNavigate();
  const { toasts, removeToast } = useToast();

  // WebSocket listener для входящих звонков
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleIncomingCall = (event: MessageEvent) => {
      try {
        const messages = event.data.split('\n').filter((m: string) => m.trim());
        for (const msgText of messages) {
          if (!msgText.trim()) continue;
          try {
            const data = JSON.parse(msgText);
            
            if (data.type === 'webrtc:offer' && user) {
              if (data.from !== user.id) {
                setIncomingCall({
                  callId: data.chatId || `call-${Date.now()}`,
                  from: data.from,
                  fromName: data.fromName,
                  fromAvatar: data.fromAvatar,
                  chatId: data.chatId,
                  isVideo: data.video || false,
                  offer: data,
                  timestamp: Date.now(),
                });
              }
            }
          } catch (e) {
            console.warn('Failed to parse WebSocket message:', e);
          }
        }
      } catch (e) {
        console.error('Failed to handle WebSocket message:', e);
      }
    };

    socket.addEventListener('message', handleIncomingCall);

    return () => {
      socket.removeEventListener('message', handleIncomingCall);
    };
  }, [user]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', ui.theme);
    initAppearance();
  }, [ui.theme]);

  // Синхронизация статуса онлайн/офлайн при фокусе и сворачивании окна/вкладки
  useEffect(() => {
    if (!user) return;

    const setStatus = (status: 'online' | 'offline' | 'away') => {
      api('/api/users/me/status', 'POST', { status }).catch(() => {});
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

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      nav('/login');
      return;
    }

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
      
      const status = err.status;
      const errorCode = err.errorCode || '';
      const errorMsg = err.message?.toLowerCase() || '';
      
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
        console.warn('Failed to load user, but not redirecting:', err.message);
      }
    });
    setupPush().catch(()=>{});
    
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = () => {
    if (!window.confirm('Вы уверены, что хотите выйти?')) return;
    setToken(null);
    setUser(null);
    if (typeof localStorage !== 'undefined') localStorage.removeItem('token');
    nav('/login');
  };

  const handleAcceptCall = (call: any) => {
    setActiveCall({
      chatId: call.chatId,
      otherUserId: call.from,
      currentUserId: user?.id,
      currentUserName: user?.username,
      currentUserAvatar: (user as any)?.avatarUrl || (user as any)?.avatar,
      isVideo: call.isVideo,
      isIncoming: true,
      offerData: call.offer,
    });
    setIncomingCall(null);
  };

  const handleDeclineCall = (call: any) => {
    sendWebSocketMessage('webrtc:hangup', {
      chatId: call.chatId,
      to: call.from,
      reason: 'declined',
    });
    setIncomingCall(null);
  };

  const handleCloseCall = () => {
    setActiveCall(null);
  };

  return (
    <motion.div 
      className="app-shell"
      data-theme={ui.theme}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <MaintenanceBanner />
      
      <Header user={user} onLogout={logout} />
      <motion.div 
        className="header" 
        style={{ padding: 'var(--spacing-md) var(--spacing-lg)', flexShrink: 0 }}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 30 }}
      >
        <nav style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Основная навигация */}
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link to="/app/chats" className="btn btn-ghost" style={{ textDecoration: 'none' }}>💬 Чаты</Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link to="/app/servers" className="btn btn-ghost" style={{ textDecoration: 'none' }}>🖥️ Серверы</Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link to="/app/contacts" className="btn btn-ghost" style={{ textDecoration: 'none' }}>👥 Контакты</Link>
          </motion.div>
          
          <div style={{ flex: 1 }} /> {/* Распорка */}

          {/* Кнопка Safety AI */}
          <motion.button
            onClick={() => setShowSafety(true)}
            className="btn btn-ghost"
            style={{ 
              textDecoration: 'none', 
              border: '1px solid var(--primary-color)', 
              background: 'rgba(59, 130, 246, 0.1)', 
              color: 'var(--primary-color)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            🛡️ Safety AI
          </motion.button>

          <motion.button
            onClick={() => setShowStories(true)}
            className="btn btn-ghost"
            style={{ textDecoration: 'none', border: 'none', background: 'transparent', cursor: 'pointer' }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            📸 Истории
          </motion.button>

          {/* Остальные кнопки */}
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link to="/app/sessions" className="btn btn-ghost" style={{ textDecoration: 'none' }}>📱 Сессии</Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link to="/app/settings" className="btn btn-ghost" style={{ textDecoration: 'none' }}>⚙️</Link>
          </motion.div>

          {(() => {
            if (!user) return null;
            let roles: string[] = [];
            const u: any = user as any;
            if (Array.isArray(u.roles)) {
              roles = u.roles;
            } else if (u.roles) {
              roles = String(u.roles).split(',').map(r => r.trim()).filter(r => r);
            }
            const hasAccess = roles.includes('admin') || roles.includes('owner');
            return hasAccess && (
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link to="/app/admin" className="btn btn-secondary" style={{ textDecoration: 'none' }}>Админка</Link>
              </motion.div>
            );
          })()}
        </nav>
      </motion.div>

      <div className={showServerStrip ? 'app-with-strip' : 'app-content'}>
        {showServerStrip && <ServerStrip />}
        <div className={showServerStrip ? 'app-content app-content-inner' : 'app-content'} style={showServerStrip ? undefined : { flex: 1 }}>
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
              <Route path="sessions" element={<SessionsPage />} />
              <Route path="feedback" element={<Feedback />} />
              <Route path="admin" element={<Admin />} />
            </Routes>
          </AnimatePresence>
        </div>
      </div>

      {/* Модальное окно Историй */}
      <AnimatePresence>
        {showStories && (
          <Stories onClose={() => setShowStories(false)} />
        )}
      </AnimatePresence>

      {/* Модальное окно Safety Assistant */}
      <AnimatePresence>
        {showSafety && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            style={{
              position: 'fixed',
              bottom: '20px',
              right: '20px',
              zIndex: 1000,
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
            }}
          >
            <SafetyAssistant onClose={() => setShowSafety(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <ConnectionStatus />
      
      <IncomingCallNotification
        call={incomingCall}
        onAccept={handleAcceptCall}
        onDecline={handleDeclineCall}
      />
      
      {activeCall && user && (
        <DMCall
          chatId={activeCall.chatId}
          otherUserId={activeCall.otherUserId}
          currentUserId={user.id}
          currentUserName={user.username}
          currentUserAvatar={(user as any).avatarUrl || (user as any).avatar}
          isVideo={activeCall.isVideo}
          isIncoming={activeCall.isIncoming}
          offerData={activeCall.offerData}
          onClose={handleCloseCall}
        />
      )}
    </motion.div>
  );
}