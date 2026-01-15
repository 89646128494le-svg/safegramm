/**
 * Admin Page - Страница администратора
 */

import React, { useEffect, useState } from 'react';
import { apiClient } from '../core/api/client';
import './Admin.css';

interface AdminProps {
  user: any;
}

export default function Admin({ user }: AdminProps) {
  const [tab, setTab] = useState<'users' | 'stats' | 'mod' | 'reports' | 'feedback'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tab === 'users') loadUsers();
    if (tab === 'stats') loadStats();
  }, [tab]);

  async function loadUsers() {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/admin/users');
      setUsers(response.users || []);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/admin/stats');
      setStats(response);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  }

  async function blockUser(userId: string) {
    if (!confirm('Заблокировать пользователя?')) return;
    try {
      await apiClient.post(`/api/admin/users/${userId}/block`);
      loadUsers();
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    }
  }

  if (loading && !users.length && !stats) {
    return (
      <div className="admin-page-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <h2>⚙️ Панель управления</h2>
      
      <div className="admin-tabs">
        <button
          className={tab === 'users' ? 'active' : ''}
          onClick={() => setTab('users')}
        >
          Пользователи
        </button>
        <button
          className={tab === 'stats' ? 'active' : ''}
          onClick={() => setTab('stats')}
        >
          Статистика
        </button>
        <button
          className={tab === 'mod' ? 'active' : ''}
          onClick={() => setTab('mod')}
        >
          Модерация
        </button>
        <button
          className={tab === 'reports' ? 'active' : ''}
          onClick={() => setTab('reports')}
        >
          Жалобы
        </button>
        <button
          className={tab === 'feedback' ? 'active' : ''}
          onClick={() => setTab('feedback')}
        >
          Обратная связь
        </button>
      </div>

      <div className="admin-content">
        {tab === 'users' && (
          <div className="admin-section">
            <h3>Пользователи</h3>
            <div className="users-list">
              {users.map(user => (
                <div key={user.id} className="user-item">
                  <div className="user-info">
                    <div className="user-name">{user.username}</div>
                    <div className="user-meta">
                      {user.plan || 'free'} • {user.roles?.join(', ') || 'user'}
                    </div>
                  </div>
                  <div className="user-actions">
                    <button
                      onClick={() => blockUser(user.id)}
                      className="btn btn-sm btn-danger"
                    >
                      Заблокировать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'stats' && stats && (
          <div className="admin-section">
            <h3>Статистика</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.totalUsers || 0}</div>
                <div className="stat-label">Пользователей</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.totalChats || 0}</div>
                <div className="stat-label">Чатов</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.totalMessages || 0}</div>
                <div className="stat-label">Сообщений</div>
              </div>
            </div>
          </div>
        )}

        {tab === 'mod' && (
          <div className="admin-section">
            <h3>Модерация</h3>
            <p>Функции модерации будут добавлены в следующих версиях.</p>
          </div>
        )}

        {tab === 'reports' && (
          <div className="admin-section">
            <h3>Жалобы</h3>
            <p>Функции обработки жалоб будут добавлены в следующих версиях.</p>
          </div>
        )}

        {tab === 'feedback' && (
          <div className="admin-section">
            <h3>Обратная связь</h3>
            <p>Функции просмотра обратной связи будут добавлены в следующих версиях.</p>
          </div>
        )}
      </div>
    </div>
  );
}
