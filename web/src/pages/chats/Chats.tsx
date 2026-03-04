
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getErrorMessage } from '../../services/api';
import { getSocket } from '../../services/websocket';
import EnhancedChatWindow from '../../components/EnhancedChatWindow';
import { showToast } from '../../components/Toast';
import { PromptModal } from '../../components/Modal';
import ChatFilters, { ChatFilter } from '../../components/ChatFilters';
import GlobalChatSearch from '../../components/GlobalChatSearch';
import ChatListItem from '../../components/ChatListItem';
import { keyboardShortcuts, defaultChatShortcuts } from '../../utils/keyboardShortcuts';
import { useStore } from '../../store/useStore';

// Функция для воспроизведения звука звонка
const playCallSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Более заметный звук звонка
    oscillator.frequency.value = 1000;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
    
    // Повторяем звук
    setTimeout(() => {
      const oscillator2 = audioContext.createOscillator();
      const gainNode2 = audioContext.createGain();
      oscillator2.connect(gainNode2);
      gainNode2.connect(audioContext.destination);
      oscillator2.frequency.value = 1000;
      oscillator2.type = 'sine';
      gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator2.start(audioContext.currentTime);
      oscillator2.stop(audioContext.currentTime + 0.3);
    }, 400);
  } catch (e) {
    console.warn('Failed to play call sound:', e);
  }
};

interface Chat {
  id: string;
  type: 'dm' | 'group' | 'channel';
  name?: string;
  members: string[];
  lastMessage?: any;
  archivedAt?: number; // Timestamp архивирования
}

interface User {
  id: string;
  username: string;
  avatarUrl?: string;
  status?: string;
  roles?: string[] | string;
}

export default function Chats() {
  const navigate = useNavigate();
  const { ui, setSidebarOpen, maintenance, setToken, setUser } = useStore();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showDMModal, setShowDMModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ChatFilter>('all');
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [starredChats, setStarredChats] = useState<Set<string>>(new Set());
  const [chatsNextCursor, setChatsNextCursor] = useState('');
  const [chatsHasMore, setChatsHasMore] = useState(false);
  const [loadingMoreChats, setLoadingMoreChats] = useState(false);
  const chatListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  }, [setSidebarOpen]);

  useEffect(() => {
    loadUser();
    loadUsers();
    loadStarredChats();
    
    // Регистрируем горячие клавиши
    defaultChatShortcuts.forEach(shortcut => {
      keyboardShortcuts.register(shortcut);
    });
    
    // Горячая клавиша для глобального поиска
    keyboardShortcuts.register({
      key: 'k',
      ctrl: true,
      callback: () => setShowGlobalSearch(true),
      description: 'Глобальный поиск',
    });
    
    return () => {
      defaultChatShortcuts.forEach(shortcut => {
        keyboardShortcuts.unregister(shortcut);
      });
    };
  }, []);

  useEffect(() => {
    loadChats();
    
    // Подключаемся к WebSocket для получения presence событий
    const socket = getSocket();
    if (socket) {
      const handleMessage = (event: MessageEvent) => {
        try {
          // Бэкенд может отправлять несколько JSON через \n
          const messages = event.data.split('\n').filter(m => m.trim());
          for (const msgText of messages) {
            if (!msgText.trim()) continue;
            try {
              const data = JSON.parse(msgText);
              handleWebSocketMessage(data);
            } catch (e) {
              console.warn('Failed to parse WebSocket message chunk:', e, msgText);
            }
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      const handleWebSocketMessage = (data: any) => {
        if (data.type === 'presence') {
            const presenceData = data.data || data;
            const userId = presenceData.userId;
            const status = presenceData.status;
            const onlineIds: string[] = Array.isArray(presenceData.online) ? presenceData.online : [];

            if (onlineIds.length > 0) {
              const onlineSet = new Set(onlineIds);
              setUsers(prev => {
                const next = new Map<string, User>();
                prev.forEach((u, id) => {
                  next.set(id, { ...u, status: onlineSet.has(id) ? 'online' : 'offline' });
                });
                return next;
              });
              setCurrentUser(prev => prev ? { ...prev, status: onlineSet.has(prev.id) ? 'online' : 'offline' } : prev);
            } else if (userId && status) {
              setUsers(prev => {
                const newMap = new Map(prev);
                const user = newMap.get(userId);
                if (user) {
                  newMap.set(userId, { ...user, status: status === 'online' ? 'online' : 'offline' });
                }
                return newMap;
              });
              if (userId === currentUser?.id) {
                setCurrentUser(prev => prev ? { ...prev, status: status === 'online' ? 'online' : 'offline' } : prev);
              }
            }
        } else if (data.type === 'webrtc:offer') {
          // Входящий звонок - воспроизводим звук и показываем уведомление
          const offerData = data.data || data;
          const fromUserId = offerData.from || data.from;
          const msgChatId = offerData.chatId || data.chatId;
          
          if (fromUserId && fromUserId !== currentUser?.id) {
            // Воспроизводим звук звонка
            playCallSound();
            
            // Находим чат с этим пользователем
            const chat = chats.find(c => {
              if (c.type === 'dm') {
                return c.members.includes(fromUserId);
              }
              return false;
            });
            
            const fromUser = users.get(fromUserId);
            const username = fromUser?.username || 'Пользователь';
            const isVideo = offerData.video !== false;
            
            // Показываем уведомление
            showToast(`Входящий ${isVideo ? 'видео' : ''}звонок от ${username}`, 'info');
            
            // Если чат открыт, автоматически показываем звонок
            if (chat && selectedChatId === chat.id) {
              // Звонок будет обработан в EnhancedChatWindow
            } else if (chat) {
              // Если чат не открыт, открываем его и показываем звонок
              setSelectedChatId(chat.id);
              // Звонок будет обработан в EnhancedChatWindow после открытия чата
            }
          }
        } else if (data.type === 'message') {
          const messageData = data.data || data;
          const msgChatId = messageData.chatId || messageData.chat_id;
          const createdAt = typeof messageData.createdAt === 'string'
            ? new Date(messageData.createdAt).getTime()
            : (typeof messageData.createdAt === 'number' ? messageData.createdAt : Date.now());

          if (msgChatId) {
            setChats(prev => {
              const lastMessage = {
                text: messageData.text || '',
                attachmentUrl: messageData.attachmentUrl || messageData.attachment_url,
                createdAt,
                senderId: messageData.senderId || messageData.sender_id,
                stickerId: messageData.stickerId || messageData.sticker_id,
                gifUrl: messageData.gifUrl || messageData.gif_url,
              };
              const updated = prev.map(chat =>
                chat.id === msgChatId
                  ? {
                      ...chat,
                      lastMessage,
                      unreadCount: msgChatId !== selectedChatId ? ((chat as any).unreadCount || 0) + 1 : (chat as any).unreadCount || 0,
                    }
                  : chat
              );
              return updated.sort((a, b) => {
                const aTime = a.lastMessage?.createdAt ?? (a as any).lastMessageAt ?? 0;
                const bTime = b.lastMessage?.createdAt ?? (b as any).lastMessageAt ?? 0;
                return (typeof bTime === 'number' ? bTime : new Date(bTime).getTime()) - (typeof aTime === 'number' ? aTime : new Date(aTime).getTime());
              });
            });
          }
        } else if (data.type === 'message:read' || data.type === 'chat:read') {
          // Сообщения прочитаны - сбрасываем счетчик
          const readData = data.data || data;
          const readChatId = readData.chatId || readData.chat_id;
          
          if (readChatId) {
            setChats(prev => prev.map(chat => {
              if (chat.id === readChatId) {
                return {
                  ...chat,
                  unreadCount: 0
                };
              }
              return chat;
            }));
          }
        }
      };
      
      socket.addEventListener('message', handleMessage);
      
      // Обновляем чаты каждые 30 секунд для синхронизации счетчиков
      const interval = setInterval(() => {
        loadChats();
      }, 30000);
      
      return () => {
        socket.removeEventListener('message', handleMessage);
        clearInterval(interval);
      };
    }
  }, [currentUser?.id, selectedChatId, chats]);

  const loadUser = async () => {
    try {
      const user = await api('/api/users/me');
      setCurrentUser(user);
    } catch (e: any) {
      if (e?.status === 401) {
        setToken(null);
        setUser(null);
        if (typeof localStorage !== 'undefined') localStorage.removeItem('token');
        navigate('/login');
        return;
      }
      console.error('Failed to load user:', e);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await api('/api/users');
      const usersMap = new Map<string, User>();
      data.users?.forEach((u: any) => {
        const status = u.isOnline ? 'online' : (u.status || 'offline');
        usersMap.set(u.id, {
          id: u.id,
          username: u.username,
          avatarUrl: u.avatarUrl,
          status,
          roles: u.roles,
        });
      });
      setUsers(usersMap);
    } catch (e: any) {
      if (e?.status === 401) {
        setToken(null);
        setUser(null);
        if (typeof localStorage !== 'undefined') localStorage.removeItem('token');
        navigate('/login');
        return;
      }
      console.error('Failed to load users:', e);
    }
  };

  const loadChats = async (append = false) => {
    if (append) {
      if (loadingMoreChats || !chatsHasMore || !chatsNextCursor) return;
      setLoadingMoreChats(true);
    } else {
      setLoading(true);
    }
    const params = new URLSearchParams();
    if (showArchived) params.set('includeArchived', 'true');
    if (append && chatsNextCursor) params.set('cursor', chatsNextCursor);
    params.set('limit', '50');
    const url = `/api/chats?${params}`;
    const CHATS_TIMEOUT_MS = 35000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), CHATS_TIMEOUT_MS)
    );
    const attemptLoad = (isRetry = false): Promise<any> =>
      Promise.race([api(url), timeoutPromise]).catch((e: any) => {
        if (!append && !isRetry && (e?.message === 'timeout' || e?.status === 511)) {
          return attemptLoad(true);
        }
        throw e;
      });
    try {
      const data = await attemptLoad();
      const list = data.chats || [];
      if (append) {
        setChats(prev => {
          const ids = new Set(prev.map((c: Chat) => c.id));
          const added = list.filter((c: Chat) => !ids.has(c.id));
          return [...prev, ...added];
        });
      } else {
        setChats(list);
      }
      setChatsNextCursor(data.nextCursor || '');
      setChatsHasMore(!!data.hasMore);
    } catch (e: any) {
      if (!append) {
        if (e?.status === 401) {
          setToken(null);
          setUser(null);
          if (typeof localStorage !== 'undefined') localStorage.removeItem('token');
          navigate('/login');
          return;
        }
        if (e?.status === 511) {
          showToast(getErrorMessage(e, 'Сеть требует авторизации. Войдите в Wi‑Fi или примите условия и обновите страницу.'), 'error');
        } else if (e?.message === 'timeout') {
          showToast('Загрузка чатов заняла много времени. Проверьте интернет и обновите страницу.', 'error');
        } else {
          showToast(getErrorMessage(e, 'Не удалось загрузить чаты. Обновите страницу.'), 'error');
        }
        setChats([]);
      }
    } finally {
      setLoading(false);
      setLoadingMoreChats(false);
    }
  };

  const archiveChat = async (chatId: string) => {
    try {
      await api(`/api/chats/${chatId}/archive`, 'POST');
      await loadChats();
      showToast('Чат заархивирован', 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось заархивировать чат.'), 'error');
    }
  };

  const unarchiveChat = async (chatId: string) => {
    try {
      await api(`/api/chats/${chatId}/unarchive`, 'POST');
      await loadChats();
      showToast('Чат разархивирован', 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось разархивировать чат.'), 'error');
    }
  };

  const deleteChat = async (chatId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот чат? Это действие нельзя отменить.')) {
      return;
    }
    try {
      await api(`/api/chats/${chatId}`, 'DELETE');
      await loadChats();
      if (selectedChatId === chatId) {
        setSelectedChatId('');
      }
      showToast('Чат удален', 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось удалить чат.'), 'error');
    }
  };

  const createDM = async (username: string) => {
    const q = username.trim();
    if (!q) return;
    if (q.length < 2 && !/^[0-9a-f-]{32,36}$/i.test(q)) {
      showToast('Введите минимум 2 символа для поиска.', 'warning');
      return;
    }
    try {
      const users = await api('/api/users/search?q=' + encodeURIComponent(q));
      const user = users.users?.[0];
      if (!user) {
        showToast('Пользователь не найден или скрыл себя из поиска. Добавьте его в контакты или попросите включить «Показывать в поиске» в настройках приватности.', 'warning');
        return;
      }
      const chat = await api('/api/chats', 'POST', { type: 'dm', memberIds: [user.id] });
      await loadChats();
      await loadUsers();
      setSelectedChatId(chat.chat?.id || chat.id);
      setShowDMModal(false);
      showToast(`Чат с ${user.username} создан`, 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось создать чат.'), 'error');
    }
  };

  const createGroup = async (name: string) => {
    if (!name.trim()) return;
    try {
      const chat = await api('/api/chats', 'POST', { type: 'group', name: name.trim() });
      await loadChats();
      setSelectedChatId(chat.chat?.id || chat.id);
      setShowGroupModal(false);
      showToast(`Группа "${name}" создана`, 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось создать группу.'), 'error');
    }
  };

  const createChannel = async (name: string) => {
    if (!name.trim()) return;
    try {
      const chat = await api('/api/chats', 'POST', { type: 'channel', name: name.trim() });
      await loadChats();
      setSelectedChatId(chat.chat?.id || chat.id);
      setShowChannelModal(false);
      showToast(`Канал "${name}" создан`, 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось создать канал.'), 'error');
    }
  };

  const getChatName = (chat: Chat) => {
    if (chat.type === 'dm') {
      const otherMemberId = chat.members.find(id => id !== currentUser?.id);
      if (otherMemberId) {
        const otherUser = users.get(otherMemberId);
        if (otherUser) return otherUser.username;
      }
      return 'Пользователь';
    }
    return chat.name || (chat.type === 'group' ? 'Группа' : 'Канал');
  };

  const getChatUser = (chat: Chat): User | null => {
    if (chat.type !== 'dm') return null;
    const otherMemberId = chat.members.find(id => id !== currentUser?.id);
    if (!otherMemberId) return null;
    return users.get(otherMemberId) || null;
  };

  const loadStarredChats = () => {
    const stored = localStorage.getItem('starredChats');
    if (stored) {
      try {
        setStarredChats(new Set(JSON.parse(stored)));
      } catch (e) {
        console.error('Failed to load starred chats:', e);
      }
    }
  };

  const saveStarredChats = (starred: Set<string>) => {
    localStorage.setItem('starredChats', JSON.stringify(Array.from(starred)));
    setStarredChats(starred);
  };

  const toggleStarChat = (chatId: string) => {
    const newStarred = new Set(starredChats);
    if (newStarred.has(chatId)) {
      newStarred.delete(chatId);
      showToast('Чат удален из закладок', 'success');
    } else {
      newStarred.add(chatId);
      showToast('Чат добавлен в закладки', 'success');
    }
    saveStarredChats(newStarred);
  };

  const getChatPreview = (chat: Chat) => {
    if (chat.lastMessage) {
      if (chat.lastMessage.text) {
        const text = chat.lastMessage.text;
        const maxLength = 50;
        return text.length > maxLength 
          ? text.slice(0, maxLength) + '...' 
          : text;
      }
      if (chat.lastMessage.attachmentUrl) {
        return '📎 Вложение';
      }
      if ((chat.lastMessage as any).stickerId) {
        return '🎨 Стикер';
      }
      if ((chat.lastMessage as any).gifUrl) {
        return '🎬 GIF';
      }
    }
    return '';
  };

  // Фильтрация чатов по поисковому запросу и активному фильтру
  const filteredChats = chats.filter(chat => {
    // Фильтр по типу
    if (activeFilter === 'groups' && chat.type !== 'group') return false;
    if (activeFilter === 'channels' && chat.type !== 'channel') return false;
    if (activeFilter === 'unread' && (!(chat as any).unreadCount || (chat as any).unreadCount === 0)) return false;
    if (activeFilter === 'starred' && !starredChats.has(chat.id)) return false;
    
    // Фильтр по архивированным
    if (showArchived && !chat.archivedAt) return false;
    if (!showArchived && chat.archivedAt) return false;
    
    // Поиск по запросу
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const chatName = getChatName(chat).toLowerCase();
      if (chatName.includes(query)) return true;
      
      // Поиск по имени пользователя в DM
      if (chat.type === 'dm') {
        const otherMemberId = chat.members.find(id => id !== currentUser?.id);
        if (otherMemberId) {
          const otherUser = users.get(otherMemberId);
          if (otherUser && otherUser.username.toLowerCase().includes(query)) {
            return true;
          }
        }
      }
      
      // Поиск по последнему сообщению
      const preview = getChatPreview(chat).toLowerCase();
      if (preview.includes(query)) {
        return true;
      }
      
      return false;
    }
    
    return true;
  });

  // Подсчет статистики для фильтров
  const unreadCount = chats.filter(c => (c as any).unreadCount > 0).length;
  const starredCount = starredChats.size;

  if (!currentUser) {
    return (
      <div className="container">
        <div className="empty">Загрузка...</div>
        <GlobalChatSearch
          isOpen={showGlobalSearch}
          onClose={() => setShowGlobalSearch(false)}
          onSelectChat={(chatId) => {
            setSelectedChatId(chatId);
            setShowGlobalSearch(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="container">
      <div className={`sidebar-overlay ${ui.sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      <div className={`sidebar ${ui.sidebarOpen ? 'open' : ''}`} aria-hidden={!ui.sidebarOpen}>
        <button type="button" className="sidebar-close-btn-mobile" onClick={() => setSidebarOpen(false)} aria-label="Закрыть">✕</button>
        {/* Профиль пользователя */}
        <div className="user-profile-card" style={{
          padding: 'var(--spacing-md)',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--spacing-md)',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            {currentUser.avatarUrl ? (
              <img 
                src={currentUser.avatarUrl} 
                alt={currentUser.username}
                style={{ width: '48px', height: '48px', borderRadius: '50%' }}
              />
            ) : (
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'var(--accent-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '20px'
              }}>
                {currentUser.username[0].toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600', fontSize: '14px' }}>{currentUser.username}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {currentUser.status === 'online' ? '🟢 В сети' : '⚫ Офлайн'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
          <h2 className="title chats-catalog-title">Мои чаты</h2>
          <button
            onClick={() => setShowGlobalSearch(true)}
            title="Глобальный поиск (Ctrl+K)"
            className="chats-catalog-search-btn"
          >
            🔍
          </button>
        </div>
        {/* Поиск по чатам — в каталоге слева */}
        <div className="chats-catalog-search-wrap">
          <input
            data-chat-search
            type="text"
            placeholder="Поиск чатов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="chats-catalog-search-input"
          />
        </div>
        {/* Кнопки типа чата — каталог */}
        <div className="chats-catalog-buttons">
          <button data-new-chat onClick={() => setShowDMModal(true)} className="btn btn-primary">
            <span>💬</span> Личный чат
          </button>
          <button onClick={() => setShowGroupModal(true)} className="btn btn-primary">
            <span>👥</span> Группа
          </button>
          <button onClick={() => setShowChannelModal(true)} className="btn btn-primary">
            <span>📢</span> Канал
          </button>
        </div>
        <div className="chats-catalog-archived">
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className={showArchived ? 'active' : ''}
          >
            {showArchived ? '📂 Активные' : '📁 Архив'}
          </button>
        </div>
        <div className="chats-catalog-filters">
          <ChatFilters
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            unreadCount={unreadCount}
            starredCount={starredCount}
            vertical
          />
        </div>
        {loading ? (
          <div className="empty-state">
            <div className="spinner"></div>
            <div style={{marginTop: 'var(--spacing-md)'}}>Загрузка...</div>
          </div>
        ) : chats.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💬</div>
            <div className="empty-state-title">Нет чатов</div>
            <div className="empty-state-description">Создайте новый чат для начала общения</div>
          </div>
        ) : (
          <>
            {searchQuery.trim() && filteredChats.length === 0 && (
              <div className="empty-state" style={{ padding: 'var(--spacing-md)' }}>
                <div className="empty-state-icon">🔍</div>
                <div className="empty-state-title">Ничего не найдено</div>
                <div className="empty-state-description">Попробуйте другой запрос</div>
              </div>
            )}
            <div
              className="chat-list"
              ref={chatListRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollHeight - el.scrollTop - el.clientHeight < 200 && chatsHasMore && !loadingMoreChats) {
                  loadChats(true);
                }
              }}
            >
              {filteredChats.map(chat => {
                const isStarred = starredChats.has(chat.id);
                return (
                  <ChatListItem
                    key={chat.id}
                    chat={{
                      ...chat,
                      isStarred,
                      unreadCount: (chat as any).unreadCount || 0,
                    }}
                    isSelected={selectedChatId === chat.id}
                    onClick={() => {
                      setSelectedChatId(chat.id);
                      if (typeof window !== 'undefined' && window.innerWidth <= 768) setSidebarOpen(false);
                    }}
                    onArchive={() => {
                      if (chat.archivedAt) {
                        unarchiveChat(chat.id);
                      } else {
                        archiveChat(chat.id);
                      }
                    }}
                    onDelete={() => deleteChat(chat.id)}
                    onStar={() => toggleStarChat(chat.id)}
                    onUnstar={() => toggleStarChat(chat.id)}
                    getChatName={getChatName}
                    getChatPreview={getChatPreview}
                    getChatUser={getChatUser}
                  />
                );
              })}
              {loadingMoreChats && (
                <div className="chat-list-load-more" style={{ padding: '8px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Загрузка…
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <div className="main chats-main">
        {maintenance?.isActive && (
          <div
            style={{
              flexShrink: 0,
              padding: '10px 16px',
              background: 'linear-gradient(135deg, rgba(255,193,7,0.2), rgba(255,152,0,0.2))',
              borderBottom: '1px solid rgba(255,152,0,0.4)',
              color: '#fef3c7',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ flexShrink: 0 }}>⚠️</span>
            <span>{maintenance.message || 'Ведутся технические работы.'}</span>
            {maintenance.timestamp && (
              <span style={{ opacity: 0.9, fontSize: '12px' }}> • {maintenance.timestamp}</span>
            )}
          </div>
        )}
        {!selectedChatId && (
          <div className="chats-mobile-menu-bar">
            <button type="button" className="chats-mobile-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Открыть список чатов">
              <span aria-hidden>☰</span>
            </button>
            <span className="chats-mobile-menu-title">Чаты</span>
          </div>
        )}
        <div className="chats-main-content">
          {selectedChatId ? (
            <EnhancedChatWindow
              chatId={selectedChatId}
              currentUser={currentUser}
              onBack={() => {
                setSelectedChatId('');
                setSidebarOpen(false);
              }}
            />
          ) : (
            <div className="empty-state chats-empty-state">
              <div className="empty-state-icon">💬</div>
              <div className="empty-state-title">Выберите чат для начала общения</div>
              <div className="empty-state-description">Создайте новый чат или выберите существующий из списка</div>
            </div>
          )}
        </div>
      </div>

      <PromptModal
        isOpen={showDMModal}
        onClose={() => setShowDMModal(false)}
        onConfirm={createDM}
        title="Создать личный чат"
        message="Введите имя пользователя:"
        placeholder="username"
        defaultValue=""
        confirmText="Создать"
        cancelText="Отмена"
      />

      <PromptModal
        isOpen={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        onConfirm={createGroup}
        title="Создать группу"
        message="Введите название группы:"
        placeholder="Название группы"
        defaultValue=""
        confirmText="Создать"
        cancelText="Отмена"
      />

      <PromptModal
        isOpen={showChannelModal}
        onClose={() => setShowChannelModal(false)}
        onConfirm={createChannel}
        title="Создать канал"
        message="Введите название канала:"
        placeholder="Название канала"
        defaultValue=""
        confirmText="Создать"
        cancelText="Отмена"
      />

      <GlobalChatSearch
        isOpen={showGlobalSearch}
        onClose={() => setShowGlobalSearch(false)}
        onSelectChat={(id) => {
          setSelectedChatId(id);
          setShowGlobalSearch(false);
        }}
      />
    </div>
  );
}
