/**
 * SafeGram Desktop - Main App Component
 */

import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { apiClient } from './core/api/client';
import { cacheDB } from './core/cache/database';
import WebSocketManager from './core/websocket/manager';
import Login from './pages/Login';
import AppShell from './pages/AppShell';
import './styles/App.css';

// Глобальный WebSocket менеджер
let wsManager: WebSocketManager | null = null;

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    initializeApp();
  }, []);

  /**
   * Инициализация приложения
   */
  async function initializeApp() {
    try {
      // Инициализация кэша
      await cacheDB.init();

      // Проверка аутентификации
      const token = apiClient.getToken();
      if (token) {
        try {
          const userData = await apiClient.get('/api/users/me');
          setUser(userData);
          setIsAuthenticated(true);

          // Инициализация WebSocket
          await initializeWebSocket(token);
        } catch (error) {
          console.error('Auth check failed:', error);
          apiClient.setToken(null);
          setIsAuthenticated(false);
        }
      }
    } catch (error) {
      console.error('Initialization error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Инициализация WebSocket
   */
  async function initializeWebSocket(token: string) {
    // Используем тот же способ получения API URL, что и в apiClient
    const getApiUrl = () => {
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        return import.meta.env.VITE_API_URL || import.meta.env.API_URL || 'http://localhost:8080';
      }
      // Fallback для process.env (будет заменен Vite)
      if (typeof process !== 'undefined' && process.env) {
        return process.env.API_URL || 'http://localhost:8080';
      }
      return 'http://localhost:8080';
    };
    const apiUrl = getApiUrl();
    const wsUrl = apiUrl.replace('http://', 'ws://').replace('https://', 'wss://');

    wsManager = new WebSocketManager({
      url: wsUrl,
      token,
      reconnectInterval: 1000,
      maxReconnectAttempts: Infinity,
      messageQueue: true
    });

    await wsManager.connect();

    // Подписка на события
    wsManager.on('message', handleWebSocketMessage);
    wsManager.on('presence', handlePresence);
    wsManager.on('typing', handleTyping);
  }

  /**
   * Обработка WebSocket сообщений
   */
  function handleWebSocketMessage(data: any) {
    // Обработка новых сообщений
    console.log('New message:', data);
  }

  /**
   * Обработка presence событий
   */
  function handlePresence(data: any) {
    console.log('Presence update:', data);
  }

  /**
   * Обработка typing событий
   */
  function handleTyping(data: any) {
    console.log('Typing:', data);
  }

  /**
   * Обработка входа
   */
  async function handleLogin(token: string) {
    apiClient.setToken(token);
    setIsAuthenticated(true);

    // Загрузка пользователя
    const userData = await apiClient.get('/api/users/me');
    setUser(userData);

    // Инициализация WebSocket
    await initializeWebSocket(token);
  }

  /**
   * Обработка выхода
   */
  function handleLogout() {
    apiClient.setToken(null);
    setIsAuthenticated(false);
    setUser(null);

    // Отключение WebSocket
    if (wsManager) {
      wsManager.disconnect();
      wsManager = null;
    }
  }

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Загрузка SafeGram...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <Login onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="/*"
          element={
            isAuthenticated ? (
              <AppShell user={user} onLogout={handleLogout} wsManager={wsManager} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

// Экспорт WebSocket менеджера для использования в компонентах
export function getWebSocketManager(): WebSocketManager | null {
  return wsManager;
}

export default App;
