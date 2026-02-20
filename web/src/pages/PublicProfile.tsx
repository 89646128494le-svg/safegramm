import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, getApiBaseUrl } from '../services/api';

export default function PublicProfile() {
  const { username } = useParams<{ username: string }>();
  const [user, setUser] = useState<{
    id: string;
    username: string;
    avatarUrl?: string;
    about?: string;
    status: string;
    statusText?: string;
    profileColor?: string;
    showBio?: boolean;
    showAvatar?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) {
      setError('Не указан пользователь');
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch(`${getApiBaseUrl()}/api/users/by-username/${encodeURIComponent(username)}`)
      .then(res => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Пользователь не найден' : 'Ошибка загрузки');
        return res.json();
      })
      .then(data => {
        if (!cancelled) setUser(data);
      })
      .catch(e => {
        if (!cancelled) setError(e.message || 'Ошибка');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [username]);

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div style={{ padding: 48, textAlign: 'center', maxWidth: 500, margin: '0 auto' }}>
        <h2 style={{ marginBottom: 16 }}>Профиль</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>{error || 'Пользователь не найден'}</p>
        <Link to="/" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>На главную</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <div style={{
        padding: 24,
        background: 'var(--bg-secondary, rgba(31, 41, 55, 0.6))',
        border: '1px solid var(--border-color, #374151)',
        borderRadius: 12,
        textAlign: 'center'
      }}>
        {(user.showAvatar !== false && user.avatarUrl) ? (
          <img
            src={user.avatarUrl}
            alt={user.username}
            style={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              objectFit: 'cover',
              marginBottom: 16,
              border: `3px solid ${user.profileColor || 'var(--accent-primary)'}`
            }}
          />
        ) : (
          <div style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: user.profileColor || 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 48,
            fontWeight: 'bold',
            color: '#fff',
            margin: '0 auto 16px'
          }}>
            {user.username?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>{user.username}</h1>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>
          {user.status === 'online' && '🟢 В сети'}
          {user.status === 'dnd' && '🔕 Не беспокоить'}
          {user.status === 'away' && '🟡 Отошёл'}
          {user.status === 'offline' && '⚫ Офлайн'}
          {!['online', 'dnd', 'away', 'offline'].includes(user.status) && '⚫ Офлайн'}
        </div>
        {user.statusText && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>{user.statusText}</div>
        )}
        {user.showBio !== false && user.about && (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{user.about}</p>
        )}
      </div>
      <p style={{ textAlign: 'center', marginTop: 24 }}>
        <Link to="/login" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>Войти в SafeGram</Link>
      </p>
    </div>
  );
}
