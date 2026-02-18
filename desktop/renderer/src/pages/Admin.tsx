/**
 * Admin Page - Страница администратора
 */

import { useEffect, useState } from 'react';
import { apiClient } from '../core/api/client';
import './Admin.css';

interface AdminProps {
  user: any;
}

export default function Admin({ user: _user }: AdminProps) {
  const [tab, setTab] = useState<'users' | 'stats' | 'analytics' | 'bans' | 'health' | 'maintenance' | 'mod' | 'reports' | 'feedback'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [bans, setBans] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [maintenance, setMaintenance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tab === 'users') loadUsers();
    if (tab === 'stats') loadStats();
    if (tab === 'analytics') loadAnalytics();
    if (tab === 'bans') loadBans();
    if (tab === 'health') loadHealth();
    if (tab === 'maintenance') loadMaintenance();
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

  async function loadAnalytics() {
    try {
      setLoading(true);
      const r = await apiClient.get('/api/admin/analytics?range=7d');
      setAnalytics(r);
    } catch (e: any) {
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadBans() {
    try {
      setLoading(true);
      const r = await apiClient.get<{ bans: any[] }>('/api/admin/bans');
      setBans(r?.bans || []);
    } catch (e: any) {
      setBans([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadHealth() {
    try {
      setLoading(true);
      const r = await apiClient.get('/api/admin/system/health');
      setHealth(r);
    } catch (e: any) {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadMaintenance() {
    try {
      setLoading(true);
      const r = await apiClient.get('/api/admin/maintenance');
      setMaintenance(r);
    } catch (e: any) {
      setMaintenance(null);
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

  async function unbanUser(userId: string) {
    try {
      await apiClient.delete('/api/admin/bans/' + userId);
      loadBans();
    } catch (e: any) {
      alert('Ошибка: ' + (e.message || ''));
    }
  }

  if (loading && !users.length && !stats && tab === 'users') {
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
        <button className={tab === 'analytics' ? 'active' : ''} onClick={() => setTab('analytics')}>
          Аналитика
        </button>
        <button className={tab === 'bans' ? 'active' : ''} onClick={() => setTab('bans')}>
          Баны
        </button>
        <button className={tab === 'health' ? 'active' : ''} onClick={() => setTab('health')}>
          Здоровье
        </button>
        <button className={tab === 'maintenance' ? 'active' : ''} onClick={() => setTab('maintenance')}>
          Техработы
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

        {tab === 'stats' && (
          <div className="admin-section">
            <h3>Статистика</h3>
            {loading ? <p>Загрузка...</p> : stats && (
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">{(stats.stats && stats.stats.users) ?? stats.users ?? 0}</div>
                  <div className="stat-label">Пользователей</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{(stats.stats && stats.stats.chats) ?? stats.chats ?? 0}</div>
                  <div className="stat-label">Чатов</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{(stats.stats && stats.stats.messages) ?? stats.messages ?? 0}</div>
                  <div className="stat-label">Сообщений</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{(stats.stats && stats.stats.online) ?? stats.online ?? 0}</div>
                  <div className="stat-label">Онлайн</div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'analytics' && (
          <div className="admin-section">
            <h3>Аналитика (7 дней)</h3>
            {loading ? <p>Загрузка...</p> : analytics ? (
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">{analytics.users ?? 0}</div>
                  <div className="stat-label">Пользователей</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{analytics.messages ?? 0}</div>
                  <div className="stat-label">Сообщений</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{analytics.activeUsers ?? 0}</div>
                  <div className="stat-label">Активных</div>
                </div>
              </div>
            ) : (
              <p>Нет данных или ошибка загрузки.</p>
            )}
          </div>
        )}

        {tab === 'bans' && (
          <div className="admin-section">
            <h3>Заблокированные</h3>
            {loading ? <p>Загрузка...</p> : bans.length === 0 ? (
              <p>Нет заблокированных.</p>
            ) : (
              <div className="users-list">
                {bans.map((b: any) => (
                  <div key={b.id || b.userId} className="user-item">
                    <div className="user-info">
                      <div className="user-name">{b.username || b.userId}</div>
                      {b.email && <div className="user-meta">{b.email}</div>}
                    </div>
                    <button type="button" className="btn btn-sm" onClick={() => unbanUser(b.userId || b.id)}>
                      Разбанить
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'health' && (
          <div className="admin-section">
            <h3>Здоровье системы</h3>
            {loading ? <p>Загрузка...</p> : health ? (
              <div>
                <p><strong>Статус:</strong> {health.status}</p>
                {health.services && (
                  <ul>
                    {health.services.map((s: any) => (
                      <li key={s.name}>{s.name}: {s.status}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p>Ошибка загрузки.</p>
            )}
          </div>
        )}

        {tab === 'maintenance' && (
          <div className="admin-section">
            <h3>Технические работы</h3>
            {loading ? <p>Загрузка...</p> : maintenance !== null ? (
              <p>Режим техработ: {maintenance.isActive ? 'включён' : 'выключен'}. {maintenance.message || ''}</p>
            ) : (
              <p>Ошибка загрузки.</p>
            )}
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
