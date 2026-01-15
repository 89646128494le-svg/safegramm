
import React, { useEffect, useState, useRef } from 'react';
import { api, API_URL } from '../services/api';

interface User {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  status?: 'online' | 'offline' | 'away' | 'busy' | 'invisible';
  bio?: string;
  lastSeen?: number;
  createdAt?: number;
}

interface UserProfileProps {
  userId: string;
  currentUserId: string;
  onClose: () => void;
}

export default function UserProfile({ userId, currentUserId, onClose }: UserProfileProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editStatus, setEditStatus] = useState<'online' | 'offline' | 'away' | 'busy' | 'invisible'>('online');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isOwnProfile = userId === currentUserId;

  useEffect(() => {
    loadUser();
  }, [userId]);

  const loadUser = async () => {
    try {
      setLoading(true);
      const data = await api(`/api/users/${userId}`);
      setUser(data.user);
      if (data.user && isOwnProfile) {
        setEditBio(data.user.bio || '');
        setEditStatus(data.user.status || 'online');
      }
    } catch (e) {
      console.error('Failed to load user:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingAvatar(true);
      const form = new FormData();
      form.append('avatar', file);
      const rsp = await fetch(`${API_URL}/api/users/me/avatar`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
        body: form
      });
      if (!rsp.ok) throw new Error('upload_error');
      const data = await rsp.json();
      setUser(prev => prev ? { ...prev, avatarUrl: data.avatarUrl } : null);
      await loadUser();
    } catch (e) {
      alert('Ошибка загрузки аватара: ' + (e instanceof Error ? e.message : 'unknown'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!isOwnProfile) return;
    try {
      await api('/api/users/me', 'PATCH', {
        bio: editBio,
        status: editStatus
      });
      await loadUser();
      setIsEditing(false);
    } catch (e: any) {
      alert('Ошибка сохранения: ' + (e.message || 'unknown'));
    }
  };

  const formatLastSeen = (timestamp?: number) => {
    if (!timestamp) return 'Никогда';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
    return date.toLocaleDateString('ru-RU');
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online': return '#10b981';
      case 'away': return '#f59e0b';
      case 'busy': return '#ef4444';
      case 'invisible': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'online': return 'В сети';
      case 'away': return 'Отошёл';
      case 'busy': return 'Занят';
      case 'invisible': return 'Невидимый';
      default: return 'Не в сети';
    }
  };

  if (loading) {
    return (
      <div className="user-profile">
        <div className="profile-loading">Загрузка...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="user-profile">
        <div className="profile-error">Пользователь не найден</div>
      </div>
    );
  }

  return (
    <div className="user-profile">
      <div className="profile-header">
        <h3>Профиль</h3>
        <button onClick={onClose} className="close-btn">✕</button>
      </div>

      <div className="profile-content">
        <div className="profile-avatar-section">
          <div className="profile-avatar-wrapper">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.username} className="profile-avatar" />
            ) : (
              <div className="profile-avatar-placeholder">
                {user.username[0].toUpperCase()}
              </div>
            )}
            {isOwnProfile && (
              <>
                <div 
                  className="avatar-upload-overlay"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingAvatar ? 'Загрузка...' : '📷'}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleAvatarUpload}
                />
              </>
            )}
            <div 
              className="status-indicator"
              style={{ backgroundColor: getStatusColor(user.status) }}
            />
          </div>
          <div className="profile-name">{user.username}</div>
          <div className="profile-status-text">{getStatusText(user.status)}</div>
          {!isOwnProfile && user.status !== 'online' && user.status !== 'invisible' && (
            <div className="profile-last-seen">
              Был(а) {formatLastSeen(user.lastSeen)}
            </div>
          )}
        </div>

        {isOwnProfile && isEditing ? (
          <div className="profile-edit-section">
            <div className="profile-field">
              <label>Статус</label>
              <select 
                value={editStatus} 
                onChange={(e) => setEditStatus(e.target.value as any)}
                className="profile-select"
              >
                <option value="online">В сети</option>
                <option value="away">Отошёл</option>
                <option value="busy">Занят</option>
                <option value="invisible">Невидимый</option>
              </select>
            </div>
            <div className="profile-field">
              <label>О себе</label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="Расскажите о себе..."
                className="profile-textarea"
                rows={4}
                maxLength={500}
              />
              <div className="char-count">{editBio.length}/500</div>
            </div>
            <div className="profile-actions">
              <button onClick={handleSaveProfile} className="save-btn">
                Сохранить
              </button>
              <button onClick={() => {
                setIsEditing(false);
                setEditBio(user.bio || '');
                setEditStatus(user.status || 'online');
              }} className="cancel-btn">
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div className="profile-info-section">
            {user.bio && (
              <div className="profile-bio">
                <h4>О себе</h4>
                <p>{user.bio}</p>
              </div>
            )}
            {user.email && isOwnProfile && (
              <div className="profile-email">
                <h4>Email</h4>
                <p>{user.email}</p>
              </div>
            )}
            {user.createdAt && (
              <div className="profile-joined">
                <h4>Дата регистрации</h4>
                <p>{new Date(user.createdAt).toLocaleDateString('ru-RU')}</p>
              </div>
            )}
            {isOwnProfile && (
              <button onClick={() => setIsEditing(true)} className="edit-btn">
                ✏️ Редактировать профиль
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}




