/**
 * Profile Page - Страница профиля
 */

import React, { useEffect, useState } from 'react';
import { apiClient } from '../core/api/client';
import './Profile.css';

interface ProfileProps {
  user: any;
}

export default function Profile({ user: initialUser }: ProfileProps) {
  const [profile, setProfile] = useState({
    username: '',
    bio: '',
    avatarUrl: '',
    status: 'online',
    plan: 'free'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [initialUser]);

  async function loadProfile() {
    try {
      setLoading(true);
      const user = await apiClient.get('/api/users/me');
      setProfile({
        username: user.username || '',
        bio: user.about || user.bio || '',
        avatarUrl: user.avatarUrl || '',
        status: user.status || 'online',
        plan: user.plan || 'free'
      });
    } catch (error: any) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    try {
      setSaving(true);
      await apiClient.patch('/api/users/me', {
        about: profile.bio,
        status: profile.status
      });
      alert('Профиль сохранен!');
    } catch (error: any) {
      alert('Ошибка сохранения: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file: File) {
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const response = await apiClient.post('/api/users/me/avatar', formData);
      setProfile(prev => ({ ...prev, avatarUrl: response.avatarUrl }));
    } catch (error: any) {
      alert('Ошибка загрузки аватара: ' + error.message);
    }
  }

  if (loading) {
    return (
      <div className="profile-page-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <h2>Профиль</h2>
      
      <div className="profile-card">
        <div className="profile-avatar-section">
          <div className="profile-avatar">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.username} />
            ) : (
              <div className="profile-avatar-placeholder">
                {profile.username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <label className="btn btn-sm">
            Изменить фото
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadAvatar(file);
              }}
            />
          </label>
        </div>

        <div className="profile-form">
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={profile.username}
              disabled
              className="form-input"
            />
            <small>Username нельзя изменить</small>
          </div>

          <div className="form-group">
            <label>О себе</label>
            <textarea
              value={profile.bio}
              onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
              className="form-textarea"
              rows={4}
              placeholder="Расскажите о себе..."
            />
          </div>

          <div className="form-group">
            <label>Статус</label>
            <select
              value={profile.status}
              onChange={(e) => setProfile(prev => ({ ...prev, status: e.target.value }))}
              className="form-select"
            >
              <option value="online">Онлайн</option>
              <option value="away">Отошел</option>
              <option value="busy">Занят</option>
              <option value="offline">Офлайн</option>
            </select>
          </div>

          <div className="form-group">
            <label>План</label>
            <div className="plan-badge">
              {profile.plan === 'premium' ? '⭐ Premium' : '🆓 Free'}
            </div>
          </div>

          <button onClick={saveProfile} disabled={saving} className="btn btn-primary">
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
