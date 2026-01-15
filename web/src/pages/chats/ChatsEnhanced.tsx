
import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../../services/api';
import EnhancedChatWindow from '../../components/EnhancedChatWindow';

interface Chat {
  id: string;
  type: 'dm' | 'group' | 'channel';
  name?: string;
  members: string[];
  lastMessage?: any;
}

interface User {
  id: string;
  username: string;
  avatarUrl?: string;
  status?: string;
}

export default function ChatsEnhanced() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
    loadChats();
  }, []);

  const loadUser = async () => {
    try {
      const user = await api('/api/users/me');
      setCurrentUser(user);
    } catch (e) {
      console.error('Failed to load user:', e);
    }
  };

  const loadChats = async () => {
    try {
      setLoading(true);
      const data = await api('/api/chats');
      setChats(data.chats || []);
    } catch (e) {
      console.error('Failed to load chats:', e);
    } finally {
      setLoading(false);
    }
  };

  const createDM = async () => {
    const username = prompt('Имя пользователя:');
    if (!username) return;
    try {
      const users = await api('/api/users/search?q=' + encodeURIComponent(username));
      const user = users.users?.[0];
      if (!user) {
        alert('Пользователь не найден');
        return;
      }
      const chat = await api('/api/chats', 'POST', { type: 'dm', memberIds: [user.id] });
      await loadChats();
      setSelectedChatId(chat.chat?.id || chat.id);
    } catch (e: any) {
      alert('Ошибка создания чата: ' + (e.message || 'unknown'));
    }
  };

  const createGroup = async () => {
    const name = prompt('Название группы:');
    if (!name) return;
    try {
      const chat = await api('/api/chats', 'POST', { type: 'group', name });
      await loadChats();
      setSelectedChatId(chat.chat?.id || chat.id);
    } catch (e: any) {
      alert('Ошибка создания группы: ' + (e.message || 'unknown'));
    }
  };

  const createChannel = async () => {
    const name = prompt('Название канала:');
    if (!name) return;
    try {
      const chat = await api('/api/chats', 'POST', { type: 'channel', name });
      await loadChats();
      setSelectedChatId(chat.chat?.id || chat.id);
    } catch (e: any) {
      alert('Ошибка создания канала: ' + (e.message || 'unknown'));
    }
  };

  const getChatName = (chat: Chat) => {
    if (chat.type === 'dm') {
      // В реальности нужно получить имя собеседника
      return 'Личный чат';
    }
    return chat.name || (chat.type === 'group' ? 'Группа' : 'Канал');
  };

  if (!currentUser) {
    return <div className="container"><div className="empty">Загрузка...</div></div>;
  }

  return (
    <div className="container">
      <div className="sidebar">
        <div className="title">Мои чаты</div>
        <div style={{ margin: '8px 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button onClick={createDM} style={{ fontSize: '13px', padding: '8px' }}>+ Личный чат</button>
          <button onClick={createGroup} style={{ fontSize: '13px', padding: '8px' }}>+ Группа</button>
          <button onClick={createChannel} style={{ fontSize: '13px', padding: '8px' }}>+ Канал</button>
        </div>
        <hr />
        {loading ? (
          <div className="empty">Загрузка...</div>
        ) : chats.length === 0 ? (
          <div className="empty">Нет чатов</div>
        ) : (
          chats.map((chat, index) => (
            <div
              key={chat.id}
              className={`list-item chat-list-item ${selectedChatId === chat.id ? 'active' : ''}`}
              onClick={() => setSelectedChatId(chat.id)}
              style={{ cursor: 'pointer', animationDelay: `${index * 0.05}s` }}
            >
              <div style={{ fontWeight: selectedChatId === chat.id ? 'bold' : 'normal' }}>
                {getChatName(chat)}
              </div>
              <div className="small" style={{ marginTop: '4px' }}>
                {chat.type === 'dm' ? 'Личный' : chat.type === 'group' ? 'Группа' : 'Канал'}
              </div>
              {chat.lastMessage && (
                <div className="small" style={{ marginTop: '4px', opacity: 0.7 }}>
                  {chat.lastMessage.text?.slice(0, 30) || 'Вложение'}...
                </div>
              )}
              {(chat as any).unreadCount > 0 && (
                <div className="notification-badge new">{(chat as any).unreadCount > 99 ? '99+' : (chat as any).unreadCount}</div>
              )}
            </div>
          ))
        )}
      </div>
      <div className="main">
        {selectedChatId ? (
          <EnhancedChatWindow
            chatId={selectedChatId}
            currentUser={currentUser}
            onClose={() => setSelectedChatId('')}
          />
        ) : (
          <div className="empty" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Выберите чат для начала общения
          </div>
        )}
      </div>
    </div>
  );
}

