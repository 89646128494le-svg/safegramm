/**
 * Enhanced Chat Window - Улучшенное окно чата
 * Адаптация веб-версии для desktop приложения
 */

import React, { useEffect, useRef, useState } from 'react';
import { apiClient } from '../core/api/client';
import WebSocketManager from '../core/websocket/manager';
import './EnhancedChatWindow.css';

interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  attachmentUrl?: string;
  createdAt: number;
  editedAt?: number;
  deletedAt?: number;
}

interface EnhancedChatWindowProps {
  chatId: string;
  currentUser: any;
  wsManager: WebSocketManager | null;
}

export default function EnhancedChatWindow({ chatId, currentUser, wsManager }: EnhancedChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<Map<string, any>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    loadUsers();
    
    if (wsManager) {
      const unsubscribe = wsManager.on('message', handleNewMessage);
      return () => {
        unsubscribe();
      };
    }
  }, [chatId, wsManager]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function loadMessages() {
    try {
      setIsLoading(true);
      const response = await apiClient.get<{ messages: Message[] }>(`/api/chats/${chatId}/messages`);
      setMessages(response.messages || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const response = await apiClient.get('/api/users');
      const usersMap = new Map();
      (response.users || []).forEach((user: any) => {
        usersMap.set(user.id, user);
      });
      setUsers(usersMap);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }

  function handleNewMessage(data: any) {
    if (data.chatId === chatId) {
      setMessages(prev => [...prev, data]);
      
      // Показываем уведомление через Electron
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const sender = users.get(data.senderId);
        (window as any).electronAPI.invoke('app:show-notification', {
          title: sender?.username || 'Новое сообщение',
          body: data.text || 'Вложение',
          silent: false
        });
      }
    }
  }

  async function handleSend() {
    if (!text.trim() || !wsManager) return;

    try {
      await apiClient.post(`/api/chats/${chatId}/messages`, {
        text: text.trim()
      });
      setText('');
    } catch (error: any) {
      alert('Ошибка отправки: ' + error.message);
    }
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  if (isLoading) {
    return (
      <div className="chat-window-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="enhanced-chat-window">
      <div className="chat-messages">
        {messages.map(message => {
          const sender = users.get(message.senderId);
          const isOwn = message.senderId === currentUser?.id;
          
          if (message.deletedAt) {
            return (
              <div key={message.id} className={`message message-deleted ${isOwn ? 'own' : ''}`}>
                <div className="message-text">Сообщение удалено</div>
              </div>
            );
          }

          return (
            <div key={message.id} className={`message ${isOwn ? 'own' : ''}`}>
              {!isOwn && (
                <div className="message-avatar">
                  {sender?.avatarUrl ? (
                    <img src={sender.avatarUrl} alt={sender.username} />
                  ) : (
                    <div className="avatar-placeholder">
                      {sender?.username?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                </div>
              )}
              <div className="message-content">
                {!isOwn && (
                  <div className="message-sender">{sender?.username || 'Unknown'}</div>
                )}
                <div className="message-text">{message.text}</div>
                {message.attachmentUrl && (
                  <div className="message-attachment">
                    <img src={message.attachmentUrl} alt="Attachment" />
                  </div>
                )}
                <div className="message-time">
                  {new Date(message.createdAt).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                  {message.editedAt && <span className="edited"> (изменено)</span>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Введите сообщение..."
          rows={1}
          className="input-textarea"
        />
        <button onClick={handleSend} disabled={!text.trim()} className="btn btn-primary">
          Отправить
        </button>
      </div>
    </div>
  );
}
