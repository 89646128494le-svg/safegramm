/**
 * Chat Window Component
 */

import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '../core/api/client';
import WebSocketManager from '../core/websocket/manager';
import './ChatWindow.css';

interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: string;
  attachmentUrl?: string;
}

interface ChatWindowProps {
  chatId: string;
  currentUser: any;
  wsManager: WebSocketManager | null;
}

export default function ChatWindow({ chatId, currentUser, wsManager }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    
    // Подписка на WebSocket события
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

  function handleNewMessage(data: any) {
    if (data.chatId === chatId) {
      setMessages(prev => [...prev, data]);
    }
  }

  async function handleSend() {
    if (!text.trim() || !wsManager) return;

    try {
      await apiClient.post(`/api/chats/${chatId}/messages`, {
        text: text.trim()
      });

      setText('');
    } catch (error) {
      console.error('Failed to send message:', error);
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
    <div className="chat-window">
      <div className="chat-messages">
        {messages.map(message => (
          <div
            key={message.id}
            className={`message ${message.senderId === currentUser?.id ? 'own' : ''}`}
          >
            <div className="message-text">{message.text}</div>
            <div className="message-time">
              {new Date(message.createdAt).toLocaleTimeString()}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Введите сообщение..."
          rows={1}
        />
        <button onClick={handleSend} disabled={!text.trim()}>
          Отправить
        </button>
      </div>
    </div>
  );
}
