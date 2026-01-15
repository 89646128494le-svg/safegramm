/**
 * Chats List Component
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '../core/api/client';
import WebSocketManager from '../core/websocket/manager';
import './Chats.css';

interface Chat {
  id: string;
  type: string;
  name?: string;
  members?: string[];
  lastMessage?: string;
  updatedAt?: string;
}

interface ChatsProps {
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  wsManager: WebSocketManager | null;
}

export default function Chats({ selectedChatId, onSelectChat, wsManager }: ChatsProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  if (isLoading) {
    return (
      <div className="chats-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="chats-list">
      {chats.map(chat => (
        <div
          key={chat.id}
          className={`chat-item ${selectedChatId === chat.id ? 'active' : ''}`}
          onClick={() => onSelectChat(chat.id)}
        >
          <div className="chat-item-name">
            {chat.name || `Chat ${chat.id.slice(0, 8)}`}
          </div>
          {chat.lastMessage && (
            <div className="chat-item-preview">
              {chat.lastMessage}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
