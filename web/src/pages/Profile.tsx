
import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, getApiBaseUrl } from '../services/api';
import { showToast } from '../components/Toast';
import { PromptModal } from '../components/Modal';
import '../styles/profile-page.css';

const STATUSES = [
  { value: 'online', label: 'В сети', color: '#10b981' },
  { value: 'away', label: 'Отошёл', color: '#f59e0b' },
  { value: 'busy', label: 'Занят', color: '#ef4444' },
  { value: 'invisible', label: 'Невидимый', color: '#6b7280' },
];

const PROFILE_COLORS = ['#7c6cff', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];

export default function Profile() {
  const [profile, setProfile] = useState<{
    username: string;
    status: string;
    bio: string;
    avatarUrl: string;
    profileColor: string;
    showBio: boolean;
    showAvatar: boolean;
    plan: string;
    links: string[];
  }>({
    username: '',
    status: 'online',
    bio: '',
    avatarUrl: '',
    profileColor: '#7c6cff',
    showBio: true,
    showAvatar: true,
    plan: 'free',
    links: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const user = await api('/api/users/me');
      setProfile({
        username: user.username || '',
        status: user.status || 'online',
        bio: user.about || user.bio || '',
        avatarUrl: user.avatarUrl || '',
        profileColor: user.profileColor || '#7c6cff',
        showBio: user.showBio !== false,
        showAvatar: user.showAvatar !== false,
        plan: user.plan || 'free',
        links: user.links || [],
      });
    } catch (e: any) {
      showToast('Ошибка загрузки профиля: ' + (e?.message || 'unknown'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    try {
      setSaving(true);
      await api('/api/users/me', 'PATCH', {
        username: profile.username.trim() || undefined,
        about: profile.bio,
        profileColor: profile.profileColor,
        showBio: profile.showBio,
        showAvatar: profile.showAvatar,
      });
      await api('/api/users/me/status', 'POST', { status: profile.status });
      showToast('Профиль сохранён', 'success');
      await loadProfile();
    } catch (e: any) {
      const msg = e?.error === 'user_exists' ? 'Это имя пользователя уже занято' : (e?.message || 'Ошибка сохранения');
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Максимум 5 МБ', 'error');
      return;
    }
    if (!file.type.startsWith('image/')) {
      showToast('Выберите изображение', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
    try {
      setUploadingAvatar(true);
      const form = new FormData();
      form.append('avatar', file);
      const rsp = await fetch(`${getApiBaseUrl()}/api/users/me/avatar`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') },
        body: form,
      });
      if (!rsp.ok) {
        const err = await rsp.json().catch(() => ({}));
        throw new Error(err.error || err.detail || 'upload_error');
      }
      const data = await rsp.json();
      setProfile((prev) => ({ ...prev, avatarUrl: data.avatarUrl }));
      setAvatarPreview(null);
      showToast('Аватар обновлён', 'success');
      await loadProfile();
    } catch (e: any) {
      showToast(e?.message || 'Ошибка загрузки аватара', 'error');
      setAvatarPreview(null);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const addLink = (link: string) => {
    if (!link.trim()) return;
    setProfile((prev) => ({ ...prev, links: [...(prev.links || []), link.trim()] }));
    setShowLinkModal(false);
  };

  const removeLink = (index: number) => {
    setProfile((prev) => ({ ...prev, links: prev.links.filter((_, i) => i !== index) }));
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-page-loading">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <motion.div
        className="profile-page-inner"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <h1 className="profile-page-title">Настройка профиля</h1>

        {/* Основные данные */}
        <section className="profile-section">
          <h2 className="profile-section-title">Основные данные</h2>

          <div className="profile-avatar-block">
            <div
              className="profile-avatar-ring"
              style={{ borderColor: profile.profileColor || '#7c6cff' }}
            >
              {avatarPreview || profile.avatarUrl ? (
                <img
                  src={avatarPreview || profile.avatarUrl}
                  alt={profile.username}
                  className="profile-avatar-img"
                />
              ) : (
                <div
                  className="profile-avatar-placeholder"
                  style={{ background: `linear-gradient(135deg, ${profile.profileColor || '#7c6cff'}, #5b8def)` }}
                >
                  {profile.username?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            <button
              type="button"
              className="profile-avatar-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              title="Изменить аватар"
            >
              {uploadingAvatar ? '⏳' : '📷'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarUpload}
            />
          </div>

          <div className="profile-field">
            <label>Имя пользователя</label>
            <input
              type="text"
              value={profile.username}
              onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))}
              placeholder="username"
              className="profile-input"
              maxLength={32}
            />
            <span className="profile-field-hint">Латиница, цифры, подчёркивание. Видно другим в чатах.</span>
          </div>

          <div className="profile-field">
            <label>Статус</label>
            <div className="profile-status-grid">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className={`profile-status-btn ${profile.status === s.value ? 'active' : ''}`}
                  style={profile.status === s.value ? { borderColor: s.color, color: s.color } : undefined}
                  onClick={() => setProfile((p) => ({ ...p, status: s.value }))}
                >
                  <span className="profile-status-dot" style={{ backgroundColor: s.color }} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="profile-field">
            <label>О себе</label>
            <textarea
              value={profile.bio}
              onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
              placeholder="Кратко о себе..."
              className="profile-textarea"
              rows={4}
              maxLength={500}
            />
            <span className="profile-char-count">{profile.bio.length}/500</span>
          </div>
        </section>

        {/* Приватность профиля */}
        <section className="profile-section">
          <h2 className="profile-section-title">Приватность профиля</h2>
          <label className="profile-toggle">
            <span>Показывать био другим</span>
            <input
              type="checkbox"
              checked={profile.showBio}
              onChange={(e) => setProfile((p) => ({ ...p, showBio: e.target.checked }))}
            />
            <span className="profile-toggle-slider" />
          </label>
          <label className="profile-toggle">
            <span>Показывать аватар</span>
            <input
              type="checkbox"
              checked={profile.showAvatar}
              onChange={(e) => setProfile((p) => ({ ...p, showAvatar: e.target.checked }))}
            />
            <span className="profile-toggle-slider" />
          </label>
          <div className="profile-field">
            <label>Цвет профиля</label>
            <div className="profile-color-row">
              {PROFILE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`profile-color-btn ${profile.profileColor === color ? 'active' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setProfile((p) => ({ ...p, profileColor: color }))}
                  title={color}
                />
              ))}
              <input
                type="color"
                value={profile.profileColor}
                onChange={(e) => setProfile((p) => ({ ...p, profileColor: e.target.value }))}
                className="profile-color-picker"
              />
            </div>
          </div>
        </section>

        {/* Ссылки */}
        <section className="profile-section">
          <div className="profile-section-head">
            <h2 className="profile-section-title">Ссылки</h2>
            <button type="button" className="profile-btn-secondary" onClick={() => setShowLinkModal(true)}>
              + Добавить
            </button>
          </div>
          {profile.links?.length > 0 ? (
            <ul className="profile-links-list">
              {profile.links.map((link, idx) => (
                <li key={idx} className="profile-link-item">
                  <a
                    href={link.startsWith('http') ? link : `https://${link}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="profile-link-url"
                  >
                    {link}
                  </a>
                  <button type="button" className="profile-link-remove" onClick={() => removeLink(idx)}>
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="profile-empty-hint">Нет ссылок. Ссылки хранятся только локально.</p>
          )}
        </section>

        {/* Сохранить */}
        <div className="profile-actions">
          <button type="button" className="profile-btn-save" onClick={save} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>

        {/* Быстрые переходы */}
        <section className="profile-section profile-section-links">
          <h2 className="profile-section-title">Ещё настройки</h2>
          <div className="profile-shortcuts">
            <Link to="/app/settings" className="profile-shortcut">
              🔔 Уведомления
            </Link>
            <Link to="/app/settings" className="profile-shortcut">
              🔒 Приватность и безопасность
            </Link>
            <Link to="/app/settings" className="profile-shortcut">
              🛡️ Безопасность и 2FA
            </Link>
            <Link to="/app/settings" className="profile-shortcut">
              🎨 Темы
            </Link>
            <Link to="/app/settings" className="profile-shortcut">
              🖼️ Внешний вид
            </Link>
            <Link to="/app/sessions" className="profile-shortcut">
              📱 Сессии
            </Link>
          </div>
        </section>

        {profile.plan && profile.plan !== 'free' && (
          <div className="profile-plan-badge">Тариф: {profile.plan.toUpperCase()}</div>
        )}
      </motion.div>

      <PromptModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onConfirm={addLink}
        title="Добавить ссылку"
        message="Введите URL:"
        placeholder="https://example.com"
        defaultValue=""
        confirmText="Добавить"
        cancelText="Отмена"
      />
    </div>
  );
}
