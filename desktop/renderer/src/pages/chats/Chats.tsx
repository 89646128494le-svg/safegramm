/**
 * Chats Page - Страница со списком чатов и окном чата
 */

import React, { useState, useEffect } from 'react';
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
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadChats();
    
    // Подписка на WebSocket события
    if (wsManager) {
      const unsubscribe = wsManager.on('message', handleNewMessage);
      return () => {
        unsubscribe();
      };
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

  function handleNewMessage(data: any) {
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
          <h2>Чаты</h2>
          <div className="chats-actions">
            <button onClick={createDM} className="btn btn-sm">+ DM</button>
            <button onClick={createGroup} className="btn btn-sm">+ Группа</button>
          </div>
        </div>
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
      <div className="chats-content">
        {selectedChatId ? (
          <EnhancedChatWindow
            chatId={selectedChatId}
            currentUser={user}
            wsManager={wsManager}
          />
        ) : (
          <div className="chats-empty-content">
            <p>Выберите чат для начала общения</p>
          </div>
        )}
      </div>
    </div>
  );
}
