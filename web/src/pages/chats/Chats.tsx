
import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../../services/api';
import { getSocket } from '../../services/websocket';
import EnhancedChatWindow from '../../components/EnhancedChatWindow';
import { showToast } from '../../components/Toast';
import { PromptModal } from '../../components/Modal';
import ChatFilters, { ChatFilter } from '../../components/ChatFilters';
import GlobalChatSearch from '../../components/GlobalChatSearch';
import ChatListItem from '../../components/ChatListItem';
import { keyboardShortcuts, defaultChatShortcuts } from '../../utils/keyboardShortcuts';

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
}

export default function Chats() {
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
            
            // Обновляем статус пользователя
            if (userId && status) {
              setUsers(prev => {
                const newMap = new Map(prev);
                const user = newMap.get(userId);
                if (user) {
                  newMap.set(userId, { ...user, status: status === 'online' ? 'online' : 'offline' });
                }
                return newMap;
              });
              
              // Обновляем статус текущего пользователя
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
            const username = fromUser?.username || fromUserId;
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
          // Новое сообщение - обновляем счетчик непрочитанных
          const messageData = data.data || data;
          const msgChatId = messageData.chatId || messageData.chat_id;
          
          // Если чат не открыт, увеличиваем счетчик
          if (msgChatId && msgChatId !== selectedChatId) {
            setChats(prev => prev.map(chat => {
              if (chat.id === msgChatId) {
                return {
                  ...chat,
                  unreadCount: ((chat as any).unreadCount || 0) + 1
                };
              }
              return chat;
            }));
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
    } catch (e) {
      console.error('Failed to load user:', e);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await api('/api/users');
      const usersMap = new Map<string, User>();
      data.users?.forEach((u: any) => {
        // Преобразуем isOnline в status
        const status = u.isOnline ? 'online' : (u.status || 'offline');
        usersMap.set(u.id, {
          id: u.id,
          username: u.username,
          avatarUrl: u.avatarUrl,
          status: status,
        });
      });
      setUsers(usersMap);
    } catch (e) {
      console.error('Failed to load users:', e);
    }
  };

  const loadChats = async () => {
    try {
      setLoading(true);
      const url = showArchived ? '/api/chats?includeArchived=true' : '/api/chats';
      const data = await api(url);
      setChats(data.chats || []);
    } catch (e: any) {
      showToast('Ошибка загрузки чатов: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const archiveChat = async (chatId: string) => {
    try {
      await api(`/api/chats/${chatId}/archive`, 'POST');
      await loadChats();
      showToast('Чат заархивирован', 'success');
    } catch (e: any) {
      showToast('Ошибка архивирования: ' + e.message, 'error');
    }
  };

  const unarchiveChat = async (chatId: string) => {
    try {
      await api(`/api/chats/${chatId}/unarchive`, 'POST');
      await loadChats();
      showToast('Чат разархивирован', 'success');
    } catch (e: any) {
      showToast('Ошибка разархивирования: ' + e.message, 'error');
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
      showToast('Ошибка удаления: ' + e.message, 'error');
    }
  };

  const createDM = async (username: string) => {
    if (!username.trim()) return;
    try {
      const users = await api('/api/users/search?q=' + encodeURIComponent(username.trim()));
      const user = users.users?.[0];
      if (!user) {
        showToast('Пользователь не найден', 'warning');
        return;
      }
      const chat = await api('/api/chats', 'POST', { type: 'dm', memberIds: [user.id] });
      await loadChats();
      await loadUsers();
      setSelectedChatId(chat.chat?.id || chat.id);
      setShowDMModal(false);
      showToast(`Чат с ${user.username} создан`, 'success');
    } catch (e: any) {
      showToast('Ошибка создания чата: ' + e.message, 'error');
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
      showToast('Ошибка создания группы: ' + e.message, 'error');
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
      showToast('Ошибка создания канала: ' + e.message, 'error');
    }
  };

  const getChatName = (chat: Chat) => {
    if (chat.type === 'dm') {
      const otherMemberId = chat.members.find(id => id !== currentUser?.id);
      if (otherMemberId) {
        const otherUser = users.get(otherMemberId);
        if (otherUser) return otherUser.username;
      }
      return 'Личный чат';
    }
    return chat.name || (chat.type === 'group' ? 'Группа' : 'Канал');
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
        <div className="empty">Загрузка...      </div>
      
      {/* Глобальный поиск */}
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
      <div className="sidebar">
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

        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)'}}>
          <h2 className="title" style={{fontSize: '20px', fontWeight: '700'}}>Мои чаты</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setShowGlobalSearch(true)}
              title="Глобальный поиск (Ctrl+K)"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              🔍
            </button>
            <span className="badge">{filteredChats.length}</span>
          </div>
        </div>
        
        {/* Фильтры чатов */}
        <ChatFilters
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          unreadCount={unreadCount}
          starredCount={starredCount}
        />
        <div style={{ margin: 'var(--spacing-md) 0', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          <button 
            data-new-chat
            onClick={() => setShowDMModal(true)}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            <span>💬</span> Личный чат
          </button>
          <button 
            onClick={() => setShowGroupModal(true)}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            <span>👥</span> Группа
          </button>
          <button 
            onClick={() => setShowChannelModal(true)}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            <span>📢</span> Канал
          </button>
        </div>
        <hr />
        {/* Поиск по чатам */}
        <div style={{ marginBottom: 'var(--spacing-sm)', padding: '0 var(--spacing-sm)' }}>
          <input
            data-chat-search
            type="text"
            placeholder="🔍 Поиск чатов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: 'var(--spacing-sm)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '13px'
            }}
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
            <div style={{ marginBottom: 'var(--spacing-sm)' }}>
              <button
                onClick={() => {
                  setShowArchived(!showArchived);
                }}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-sm)',
                  background: showArchived ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: showArchived ? 'white' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                {showArchived ? '📂 Показать активные' : '📁 Показать архивированные'}
              </button>
            </div>
            {searchQuery.trim() && filteredChats.length === 0 && (
              <div className="empty-state" style={{ padding: 'var(--spacing-md)' }}>
                <div className="empty-state-icon">🔍</div>
                <div className="empty-state-title">Ничего не найдено</div>
                <div className="empty-state-description">Попробуйте другой запрос</div>
              </div>
            )}
            <div className="chat-list">
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
                    onClick={() => setSelectedChatId(chat.id)}
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
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
      <div className="main">
        {selectedChatId ? (
          <EnhancedChatWindow
            chatId={selectedChatId}
            currentUser={currentUser}
          />
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">💬</div>
            <div className="empty-state-title">Выберите чат для начала общения</div>
            <div className="empty-state-description">Создайте новый чат или выберите существующий из списка</div>
          </div>
        )}
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
    </div>
  );
}
