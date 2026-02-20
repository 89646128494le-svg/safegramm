
import React, { useEffect, useState, useRef } from 'react';
import { api, getApiBaseUrl } from '../services/api';
import { showToast } from '../components/Toast';
import { PromptModal } from '../components/Modal';

export default function Profile() {
  const [profile, setProfile] = useState<any>({ 
    displayName: '', 
    status: 'online', 
    statusText: '',
    bio: '', 
    links: [] as string[],
    username: '',
    avatarUrl: '',
    plan: '',
    roles: [] as string[],
    createdAt: 0
  });
  const [trustScore, setTrustScore] = useState<{ identityVerified?: boolean; sessionVerified?: boolean } | null>(null);
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
        displayName: user.username || '',
        status: user.status || 'online',
        statusText: user.statusText || '',
        bio: user.about || user.bio || '',
        links: user.links || [],
        username: user.username || '',
        avatarUrl: user.avatarUrl || '',
        plan: user.plan || 'free',
        roles: Array.isArray(user.roles) ? user.roles : (user.roles ? String(user.roles).split(',').map((r: string) => r.trim()).filter(Boolean) : []),
        createdAt: user.createdAt || Date.now()
      });
      try {
        const ts = await api('/api/security/trust-score');
        setTrustScore(ts || null);
      } catch {
        setTrustScore(null);
      }
    } catch (e: any) {
      showToast('Ошибка загрузки профиля: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    try {
      setSaving(true);
      await api('/api/users/me', 'PATCH', {
        username: profile.username,
        about: profile.bio,
        status: profile.status,
        statusText: profile.statusText || '',
        profileColor: profile.profileColor
      });
      showToast('Профиль сохранён', 'success');
      await loadProfile();
    } catch (e: any) {
      showToast('Ошибка сохранения: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Валидация размера (макс 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('Файл слишком большой (максимум 5MB)', 'error');
      return;
    }

    // Валидация типа
    if (!file.type.startsWith('image/')) {
      showToast('Выберите изображение', 'error');
      return;
    }

    // Превью
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    try {
      setUploadingAvatar(true);
      const form = new FormData();
      form.append('avatar', file);
      const rsp = await fetch(`${getApiBaseUrl()}/api/users/me/avatar`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
        body: form
      });
      if (!rsp.ok) {
        const errorData = await rsp.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.detail || 'upload_error');
      }
      const data = await rsp.json();
      setProfile(prev => ({ ...prev, avatarUrl: data.avatarUrl }));
      setAvatarPreview(null);
      showToast('Аватар обновлён', 'success');
      await loadProfile();
    } catch (e: any) {
      showToast('Ошибка загрузки аватара: ' + (e.message || 'unknown'), 'error');
      setAvatarPreview(null);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const addLink = (link: string) => {
    if (!link.trim()) return;
    const links = [...(profile.links || []), link.trim()];
    setProfile({ ...profile, links });
    setShowLinkModal(false);
  };

  const removeLink = (index: number) => {
    const links = profile.links.filter((_: string, i: number) => i !== index);
    setProfile({ ...profile, links });
  };

  const statuses = [
    { value: 'online', label: '🟢 В сети' },
    { value: 'away', label: '🟡 Отошёл' },
    { value: 'busy', label: '🔴 Занят' },
    { value: 'dnd', label: '🔕 Не беспокоить' },
    { value: 'invisible', label: '⚪ Невидимка' },
    { value: 'offline', label: '⚫ Офлайн' }
  ];

  if (loading) {
    return (
      <div style={{padding: '48px', textAlign: 'center'}}>
        <div className="empty">Загрузка...</div>
      </div>
    );
  }

  return (
    <div style={{padding: '24px', maxWidth: 800, margin: '0 auto'}}>
      <h2 style={{marginBottom: '24px', fontSize: '28px', fontWeight: '700'}}>Профиль</h2>
      
      <div style={{
        padding: '24px',
        background: 'var(--panel, rgba(31, 41, 55, 0.6))',
        border: '1px solid var(--border, #374151)',
        borderRadius: '12px',
        marginBottom: '24px'
      }}>
        {/* Аватар */}
        <div style={{marginBottom: '24px', textAlign: 'center'}}>
          <div style={{position: 'relative', display: 'inline-block'}}>
            {avatarPreview || profile.avatarUrl ? (
              <img 
                src={avatarPreview || profile.avatarUrl} 
                alt={profile.username}
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid var(--accent, #3b82f6)'
                }}
              />
            ) : (
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: 'var(--accent, #3b82f6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '48px',
                fontWeight: 'bold',
                color: '#fff',
                border: '3px solid var(--accent, #3b82f6)'
              }}>
                {profile.username?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                position: 'absolute',
                bottom: '0',
                right: '0',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--accent, #3b82f6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: uploadingAvatar ? 'not-allowed' : 'pointer',
                border: '3px solid var(--panel, rgba(31, 41, 55, 0.6))',
                opacity: uploadingAvatar ? 0.6 : 1
              }}
              title="Изменить аватар"
            >
              {uploadingAvatar ? '⏳' : '📷'}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarUpload}
            />
          </div>
        </div>

        <div style={{marginBottom: '24px'}}>
          <label style={{display: 'block', marginBottom: '8px', fontWeight: '600'}}>
            Имя пользователя
          </label>
          <input 
            type="text"
            value={profile.username} 
            disabled
            style={{
              width: '100%',
              padding: '12px',
              background: 'var(--panel-2, #111827)',
              border: '1px solid var(--border, #374151)',
              borderRadius: '8px',
              color: 'var(--subtle, #9ca3af)',
              cursor: 'not-allowed'
            }}
          />
          <div className="small" style={{marginTop: '4px', color: 'var(--subtle, #9ca3af)'}}>
            Имя пользователя нельзя изменить
          </div>
        </div>

        <div style={{marginBottom: '24px'}}>
          <label style={{display: 'block', marginBottom: '8px', fontWeight: '600'}}>
            Статус
          </label>
          <select
            value={profile.status}
            onChange={e => setProfile({...profile, status: e.target.value})}
            style={{
              width: '100%',
              padding: '12px',
              background: 'var(--panel-2, #111827)',
              border: '1px solid var(--border, #374151)',
              borderRadius: '8px',
              color: 'var(--fg, #e5e7eb)',
              cursor: 'pointer'
            }}
          >
            {statuses.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {profile.status === 'dnd' && (
            <div style={{ marginTop: '12px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
                Подпись (например: «Встреча до 15:00»)
              </label>
              <input
                type="text"
                placeholder="Не беспокоить до..."
                value={profile.statusText || ''}
                onChange={e => setProfile({ ...profile, statusText: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--panel-2, #111827)',
                  border: '1px solid var(--border, #374151)',
                  borderRadius: '8px',
                  color: 'var(--fg, #e5e7eb)'
                }}
              />
            </div>
          )}
        </div>

        {profile.username && (
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Ссылка на профиль</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <code style={{
                padding: '10px 12px',
                background: 'var(--panel-2, #111827)',
                border: '1px solid var(--border, #374151)',
                borderRadius: '8px',
                fontSize: '14px',
                flex: 1,
                minWidth: 0
              }}>
                {typeof window !== 'undefined' ? `${window.location.origin}/u/${profile.username}` : `/u/${profile.username}`}
              </code>
              <button
                type="button"
                onClick={() => {
                  const url = typeof window !== 'undefined' ? `${window.location.origin}/u/${profile.username}` : '';
                  if (url && navigator.clipboard) {
                    navigator.clipboard.writeText(url);
                    showToast('Ссылка скопирована', 'success');
                  }
                }}
                style={{
                  padding: '10px 16px',
                  background: 'var(--accent, #3b82f6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Копировать
              </button>
            </div>
          </div>
        )}

        <div style={{marginBottom: '24px'}}>
          <label style={{display: 'block', marginBottom: '8px', fontWeight: '600'}}>
            О себе (био)
          </label>
          <textarea 
            placeholder="Расскажите о себе..."
            value={profile.bio} 
            onChange={e=>setProfile({...profile, bio: e.target.value})}
            maxLength={500}
            rows={4}
            style={{
              width: '100%',
              padding: '12px',
              background: 'var(--panel-2, #111827)',
              border: '1px solid var(--border, #374151)',
              borderRadius: '8px',
              color: 'var(--fg, #e5e7eb)',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
          />
          <div className="small" style={{marginTop: '4px', color: 'var(--subtle, #9ca3af)', textAlign: 'right'}}>
            {profile.bio.length}/500
          </div>
        </div>

        <div style={{marginBottom: '24px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
            <label style={{fontWeight: '600'}}>Ссылки</label>
            <button
              onClick={() => setShowLinkModal(true)}
              style={{
                padding: '8px 16px',
                background: 'var(--accent, #3b82f6)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              + Добавить ссылку
            </button>
          </div>
          {profile.links && profile.links.length > 0 ? (
            <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
              {profile.links.map((link: string, idx: number) => (
                <div 
                  key={idx}
                  style={{
                    padding: '12px',
                    background: 'var(--panel-2, #111827)',
                    border: '1px solid var(--border, #374151)',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <a 
                    href={link.startsWith('http') ? link : `https://${link}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{color: 'var(--accent, #3b82f6)', textDecoration: 'none'}}
                  >
                    {link}
                  </a>
                  <button
                    onClick={() => removeLink(idx)}
                    style={{
                      padding: '4px 8px',
                      background: '#dc3545',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Удалить
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="small" style={{color: 'var(--subtle, #9ca3af)', fontStyle: 'italic'}}>
              Нет ссылок
            </div>
          )}
        </div>

        {(profile.plan || (profile.roles && profile.roles.length > 0)) && (
          <div style={{
            padding: '12px',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '8px',
            marginBottom: '24px'
          }}>
            <div className="small" style={{color: 'var(--accent, #3b82f6)'}}>
              {profile.plan && <span>Тариф: <strong>{profile.plan.toUpperCase()}</strong></span>}
              {profile.plan && profile.roles?.length > 0 && ' · '}
              {profile.roles?.length > 0 && (
                <span>Роли: {profile.roles.map((r: string) => (
                  <span key={r} style={{ marginRight: '6px', padding: '2px 6px', borderRadius: '4px', background: r === 'owner' ? 'rgba(124, 58, 237, 0.3)' : 'rgba(59, 130, 246, 0.2)' }}>{r}</span>
                ))}</span>
              )}
            </div>
          </div>
        )}

        {trustScore != null && (
          <div style={{
            padding: '16px',
            background: 'rgba(124, 108, 255, 0.08)',
            border: '1px solid rgba(124, 108, 255, 0.2)',
            borderRadius: '12px',
            marginBottom: '24px'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--fg, #e5e7eb)' }}>Уровень доверия (Trust Score)</div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span style={{ color: trustScore.identityVerified ? '#10b981' : 'var(--subtle, #9ca3af)' }}>
                {trustScore.identityVerified ? '✓ Идентичность верифицирована (Ed25519)' : '— Идентичность не привязана'}
              </span>
              <span style={{ color: trustScore.sessionVerified ? '#10b981' : 'var(--subtle, #9ca3af)' }}>
                {trustScore.sessionVerified ? '✓ Сессия верифицирована' : '— Сессия не верифицирована'}
              </span>
            </div>
          </div>
        )}

        <button 
          onClick={save}
          disabled={saving}
          style={{
            width: '100%',
            padding: '12px 24px',
            background: saving ? '#6b7280' : 'var(--accent, #3b82f6)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: '600'
          }}
        >
          {saving ? 'Сохранение...' : '💾 Сохранить изменения'}
        </button>
      </div>

      <PromptModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onConfirm={addLink}
        title="Добавить ссылку"
        message="Введите URL ссылки:"
        placeholder="https://example.com"
        defaultValue=""
        confirmText="Добавить"
        cancelText="Отмена"
      />
    </div>
  );
}
