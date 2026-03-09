/**
 * Settings Page - Страница настроек
 */

import { useEffect, useState } from 'react';
import { apiClient } from '../core/api/client';
import './Settings.css';

interface SettingsProps {
  user: any;
}

const DEFAULT_SERVER_URL = 'https://141.8.198.152.nip.io';

export default function Settings({ user: _user }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'notifications' | 'privacy' | 'themes' | 'security' | 'connection'>('notifications');
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [serverUrlSaving, setServerUrlSaving] = useState(false);
  const hasElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;
  const [notifications, setNotifications] = useState({
    pushEnabled: true,
    soundEnabled: true,
    desktopEnabled: true,
    mentionsOnly: false,
    previewEnabled: true,
    groupsEnabled: true,
    channelsEnabled: true,
    soundVolume: 80
  });
  const [privacy, setPrivacy] = useState({
    showBio: true,
    showAvatar: true,
    showLastSeen: true,
    showReadReceipts: true,
    allowGroupInvites: true,
    profileColor: '#3b82f6'
  });
  const [saving, setSaving] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function saveServerUrl() {
    if (!(window as any).electronAPI) return;
    setServerUrlSaving(true);
    try {
      await (window as any).electronAPI.setConfig('serverUrl', serverUrl.trim() || DEFAULT_SERVER_URL);
      if (window.confirm('Адрес сервера сохранён. Перезагрузить приложение для применения?')) {
        window.location.reload();
      }
    } catch (e: any) {
      alert('Ошибка: ' + (e?.message || e));
    } finally {
      setServerUrlSaving(false);
    }
  }

  async function loadSettings() {
    try {
      if (hasElectron && (window as any).electronAPI) {
        const config = await (window as any).electronAPI.getConfig();
        if (config && config.serverUrl != null && String(config.serverUrl).trim()) {
          setServerUrl(String(config.serverUrl));
        } else {
          setServerUrl(DEFAULT_SERVER_URL);
        }
      }
      const notifData = await apiClient.get('/api/users/me/notifications');
      if (notifData) setNotifications(prev => ({ ...prev, ...notifData }));

      const privacyData = await apiClient.get('/api/users/me/privacy');
      if (privacyData) setPrivacy(prev => ({ ...prev, ...privacyData }));
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async function saveNotifications() {
    try {
      setSaving(true);
      await apiClient.post('/api/users/me/notifications', notifications);
      
      // Обновление настроек Electron
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        (window as any).electronAPI.invoke('app:set-config', 'notifications', notifications.desktopEnabled);
      }
    } catch (error: any) {
      alert('Ошибка сохранения: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  async function savePrivacy() {
    try {
      setSaving(true);
      await apiClient.post('/api/users/me/privacy', privacy);
    } catch (error: any) {
      alert('Ошибка сохранения: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  function changeTheme(theme: string) {
    setCurrentTheme(theme);
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }

  return (
    <div className="settings-page">
      <h2>Настройки</h2>
      
      <div className="settings-tabs">
        <button
          className={activeTab === 'notifications' ? 'active' : ''}
          onClick={() => setActiveTab('notifications')}
        >
          Уведомления
        </button>
        <button
          className={activeTab === 'privacy' ? 'active' : ''}
          onClick={() => setActiveTab('privacy')}
        >
          Приватность
        </button>
        <button
          className={activeTab === 'themes' ? 'active' : ''}
          onClick={() => setActiveTab('themes')}
        >
          Темы
        </button>
        <button
          className={activeTab === 'security' ? 'active' : ''}
          onClick={() => setActiveTab('security')}
        >
          Безопасность
        </button>
        {hasElectron && (
          <button
            className={activeTab === 'connection' ? 'active' : ''}
            onClick={() => setActiveTab('connection')}
          >
            Подключение
          </button>
        )}
      </div>

      <div className="settings-content">
        {activeTab === 'notifications' && (
          <div className="settings-section">
            <h3>Уведомления</h3>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={notifications.desktopEnabled}
                  onChange={(e) => {
                    setNotifications(prev => ({ ...prev, desktopEnabled: e.target.checked }));
                    saveNotifications();
                  }}
                />
                Десктопные уведомления
              </label>
            </div>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={notifications.soundEnabled}
                  onChange={(e) => setNotifications(prev => ({ ...prev, soundEnabled: e.target.checked }))}
                />
                Звук уведомлений
              </label>
            </div>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={notifications.previewEnabled}
                  onChange={(e) => setNotifications(prev => ({ ...prev, previewEnabled: e.target.checked }))}
                />
                Показывать превью сообщений
              </label>
            </div>
            <button onClick={saveNotifications} disabled={saving} className="btn btn-primary">
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="settings-section">
            <h3>Приватность</h3>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={privacy.showLastSeen}
                  onChange={(e) => setPrivacy(prev => ({ ...prev, showLastSeen: e.target.checked }))}
                />
                Показывать время последнего посещения
              </label>
            </div>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={privacy.showReadReceipts}
                  onChange={(e) => setPrivacy(prev => ({ ...prev, showReadReceipts: e.target.checked }))}
                />
                Показывать прочитанные сообщения
              </label>
            </div>
            <button onClick={savePrivacy} disabled={saving} className="btn btn-primary">
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        )}

        {activeTab === 'themes' && (
          <div className="settings-section">
            <h3>Темы</h3>
            <div className="theme-options">
              <button
                className={`theme-option ${currentTheme === 'dark' ? 'active' : ''}`}
                onClick={() => changeTheme('dark')}
              >
                🌙 Темная
              </button>
              <button
                className={`theme-option ${currentTheme === 'light' ? 'active' : ''}`}
                onClick={() => changeTheme('light')}
              >
                ☀️ Светлая
              </button>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="settings-section">
            <h3>Безопасность</h3>
            <p>Функции безопасности будут добавлены в следующих версиях.</p>
          </div>
        )}

        {activeTab === 'connection' && hasElectron && (
          <div className="settings-section">
            <h3>Подключение к серверу</h3>
            <p className="settings-hint">Укажите адрес API (например, туннель ngrok или ваш ПК). По умолчанию — https://141.8.198.152.nip.io.</p>
            <div className="setting-item">
              <label>Адрес сервера (API)</label>
              <input
                type="url"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://your-tunnel.ngrok.io или https://141.8.198.152.nip.io"
                className="settings-input"
              />
            </div>
            <button onClick={saveServerUrl} disabled={serverUrlSaving} className="btn btn-primary">
              {serverUrlSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
