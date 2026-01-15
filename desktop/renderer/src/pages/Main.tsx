/**
 * Main Page - Главная страница приложения
 */

import React, { useState, useEffect } from 'react';
import WebSocketManager from '../core/websocket/manager';
import Chats from '../components/Chats';
import ChatWindow from '../components/ChatWindow';
import './Main.css';

interface MainProps {
  user: any;
  onLogout: () => void;
  wsManager: WebSocketManager | null;
}

export default function Main({ user, onLogout, wsManager }: MainProps) {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  // Интеграция с Electron API
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const electronAPI = (window as any).electronAPI;

      // Обработка горячих клавиш
      electronAPI.on('toggle-mute', () => {
        // TODO: Переключение звука
      });
    }
  }, []);

  return (
    <div className="main-page">
      <div className="main-sidebar">
        <div className="sidebar-header">
          <h2>SafeGram</h2>
          <button onClick={onLogout} className="btn btn-ghost">
            Выход
          </button>
        </div>
        <Chats
          selectedChatId={selectedChatId}
          onSelectChat={setSelectedChatId}
          wsManager={wsManager}
        />
      </div>
      <div className="main-content">
        {selectedChatId ? (
          <ChatWindow
            chatId={selectedChatId}
            currentUser={user}
            wsManager={wsManager}
          />
        ) : (
          <div className="empty-chat">
            <p>Выберите чат для начала общения</p>
          </div>
        )}
      </div>
    </div>
  );
}
