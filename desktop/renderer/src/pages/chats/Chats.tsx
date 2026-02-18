/**
 * Chats Page - Страница со списком чатов и окном чата
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../../core/api/client';
import WebSocketManager from '../../core/websocket/manager';
import EnhancedChatWindow from '../../components/EnhancedChatWindow';
import './Chats.css';

interface Chat {
  id: string;
  type: 'dm' | 'group' | 'channel';
  name?: string;
  title?: string;
  members?: string[];
  lastMessage?: string;
  updatedAt?: string;
  unreadCount?: number;
}

interface ChatsProps {
  wsManager: WebSocketManager | null;
  user: any;
}

export default function Chats({ wsManager, user }: ChatsProps) {
  const [searchParams] = useSearchParams();
  const chatIdFromUrl = searchParams.get('chatId');
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(chatIdFromUrl || null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (chatIdFromUrl && chatIdFromUrl !== selectedChatId) {
      setSelectedChatId(chatIdFromUrl);
    }
  }, [chatIdFromUrl]);

  useEffect(() => {
    loadChats();
    if (wsManager) {
      const unsubscribe = wsManager.on('message', handleNewMessage);
      return () => unsubscribe();
    }
  }, [wsManager]);

  async function loadChats() {
    try {
      setIsLoading(true);
      const response = await apiClient.get<{ chats: Chat[] }>('/api/chats');
      setChats(response.chats || []);
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleNewMessage(_data: any) {
    // Обновление списка чатов при новом сообщении
    loadChats();
  }

  async function createDM() {
    const username = prompt('Введите username пользователя для создания DM:');
    if (!username) return;

    try {
      const response = await apiClient.post('/api/chats', {
        type: 'dm',
        memberUsernames: [username]
      });
      setSelectedChatId(response.id);
      loadChats();
    } catch (error: any) {
      alert(error.message || 'Не удалось создать чат');
    }
  }

  async function createGroup() {
    const name = prompt('Введите название группы:');
    if (!name) return;

    try {
      const response = await apiClient.post('/api/chats', {
        type: 'group',
        name
      });
      setSelectedChatId(response.id);
      loadChats();
    } catch (error: any) {
      alert(error.message || 'Не удалось создать группу');
    }
  }

  async function createChannel() {
    const name = prompt('Введите название канала:');
    if (!name?.trim()) return;
    try {
      const response = await apiClient.post('/api/chats', {
        type: 'channel',
        name: name.trim()
      });
      setSelectedChatId(response.id);
      loadChats();
    } catch (error: any) {
      alert(error.message || 'Не удалось создать канал');
    }
  }

  async function deleteChat(chatId: string) {
    if (!confirm('Вы уверены, что хотите удалить этот чат?')) return;

    try {
      await apiClient.delete(`/api/chats/${chatId}`);
      if (selectedChatId === chatId) {
        setSelectedChatId(null);
      }
      loadChats();
    } catch (error: any) {
      alert(error.message || 'Не удалось удалить чат');
    }
  }

  const filteredChats = chats.filter(chat => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      chat.name?.toLowerCase().includes(query) ||
      chat.title?.toLowerCase().includes(query) ||
      chat.lastMessage?.toLowerCase().includes(query)
    );
  });

  const selectedChat = selectedChatId ? chats.find(c => c.id === selectedChatId) : null;
  const chatInputLabel = selectedChat
    ? `Чат: ${selectedChat.name || selectedChat.title || selectedChat.id.slice(0, 8)}`
    : undefined;

  if (isLoading) {
    return (
      <div className="chats-page-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="chats-page">
      <div className="chats-sidebar">
        <div className="chats-header">
          <h2>Мои чаты</h2>
          <div className="chats-actions chats-actions-center">
            <button onClick={createDM} className="btn btn-sm">💬 Личный чат</button>
            <button onClick={createGroup} className="btn btn-sm">👥 Группа</button>
            <button onClick={createChannel} className="btn btn-sm">📢 Канал</button>
          </div>
        </div>
        <div className="chats-catalog">
        <div className="chats-search">
          <input
            type="text"
            placeholder="Поиск чатов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="chats-list">
          {filteredChats.length === 0 ? (
            <div className="chats-empty">
              <p>Нет чатов</p>
              <p className="chats-empty-hint">Создайте новый чат или дождитесь сообщений</p>
            </div>
          ) : (
            filteredChats.map(chat => (
              <div
                key={chat.id}
                className={`chat-item ${selectedChatId === chat.id ? 'active' : ''} ${chat.unreadCount ? 'unread' : ''}`}
                onClick={() => setSelectedChatId(chat.id)}
              >
                <div className="chat-item-content">
                  <div className="chat-item-name">
                    {chat.name || chat.title || `Chat ${chat.id.slice(0, 8)}`}
                  </div>
                  {chat.lastMessage && (
                    <div className="chat-item-preview">
                      {chat.lastMessage}
                    </div>
                  )}
                  {chat.updatedAt && (
                    <div className="chat-item-time">
                      {new Date(chat.updatedAt).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  )}
                </div>
                {chat.unreadCount && chat.unreadCount > 0 && (
                  <div className="chat-item-unread">
                    {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                  </div>
                )}
                <button
                  className="chat-item-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(chat.id);
                  }}
                  title="Удалить чат"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
        </div>
      </div>
      <div className="chats-content">
        {selectedChatId ? (
          <EnhancedChatWindow
            chatId={selectedChatId}
            currentUser={user}
            wsManager={wsManager}
            inputLabel={chatInputLabel}
            chatTitle={selectedChat?.name || selectedChat?.title || `Чат ${selectedChatId.slice(0, 8)}`}
          />
        ) : (
          <div className="chats-empty-content">
            <div className="chats-empty-content-inner">
              <div className="chats-empty-icon">💬</div>
              <p className="chats-empty-title">Выберите чат для начала общения</p>
              <p className="chats-empty-desc">Создайте новый чат или выберите существующий из списка слева</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
