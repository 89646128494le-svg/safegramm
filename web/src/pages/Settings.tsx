
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import ThemePicker from '../components/ThemePicker';
import '../styles/settings.css';

interface NotificationSettings {
  pushEnabled: boolean;
  soundEnabled: boolean;
  desktopEnabled: boolean;
  mentionsOnly: boolean;
  previewEnabled: boolean;
  groupsEnabled: boolean;
  channelsEnabled: boolean;
  soundVolume: number;
}

interface PrivacySettings {
  showBio: boolean;
  showAvatar: boolean;
  showLastSeen: boolean;
  showReadReceipts: boolean;
  allowGroupInvites: boolean;
  profileColor: string;
}

interface SecuritySettings {
  twoFactorEnabled: boolean;
  pinEnabled: boolean;
  activeSessions: Array<{id: string, device: string, lastActivity: number}>;
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'notifications' | 'privacy' | 'themes' | 'security' | 'appearance'>('notifications');
  const [notifications, setNotifications] = useState<NotificationSettings>({
    pushEnabled: true,
    soundEnabled: true,
    desktopEnabled: true,
    mentionsOnly: false,
    previewEnabled: true,
    groupsEnabled: true,
    channelsEnabled: true,
    soundVolume: 80
  });
  const [privacy, setPrivacy] = useState<PrivacySettings>({
    showBio: true,
    showAvatar: true,
    showLastSeen: true,
    showReadReceipts: true,
    allowGroupInvites: true,
    profileColor: '#3b82f6'
  });
  const [security, setSecurity] = useState<SecuritySettings>({
    twoFactorEnabled: false,
    pinEnabled: false,
    activeSessions: []
  });
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null);
  const [user, setUser] = useState<any>(null);
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') || 'dark') as 'dark' | 'light';
  });

  useEffect(() => {
    loadSettings();
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const u = await api('/api/users/me');
      setUser(u);
    } catch (e) {
      console.error('Failed to load user:', e);
    }
  };

  const loadSettings = async () => {
    try {
      // Загружаем настройки уведомлений
      try {
        const notifData = await api('/api/users/me/notifications');
        setNotifications(prev => ({ ...prev, ...notifData }));
      } catch (e) {
        console.log('Notifications settings not found, using defaults');
      }

      // Загружаем настройки приватности
      try {
        const privacyData = await api('/api/users/me/privacy');
        setPrivacy(prev => ({ ...prev, ...privacyData }));
      } catch (e) {
        // Используем данные из профиля пользователя
        loadUser();
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  };

  const saveNotifications = async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      await api('/api/users/me/notifications', 'POST', notifications);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (e: any) {
      setSaveStatus('error');
      console.error('Failed to save notifications:', e);
    } finally {
      setSaving(false);
    }
  };

  const savePrivacy = async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      await api('/api/users/me/privacy', 'POST', privacy);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 2000);
      await loadUser();
    } catch (e: any) {
      setSaveStatus('error');
      console.error('Failed to save privacy:', e);
    } finally {
      setSaving(false);
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotifications(prev => ({ ...prev, pushEnabled: true }));
        await saveNotifications();
      } else {
        alert('Разрешение на уведомления не предоставлено');
      }
    }
  };

  const toggleTwoFactor = async () => {
    if (security.twoFactorEnabled) {
      if (confirm('Вы уверены, что хотите отключить двухфакторную аутентификацию? Введите код из приложения-аутентификатора для подтверждения.')) {
        const code = prompt('Введите код из приложения-аутентификатора:');
        if (!code) return;
        
        try {
          setSaving(true);
          await api('/api/users/me/2fa/disable', 'POST', { code });
          setSecurity(prev => ({ ...prev, twoFactorEnabled: false }));
          setSaveStatus('success');
          setTimeout(() => setSaveStatus(null), 2000);
        } catch (e: any) {
          alert('Ошибка: ' + (e.message || 'Неверный код'));
          setSaveStatus('error');
          setTimeout(() => setSaveStatus(null), 2000);
        } finally {
          setSaving(false);
        }
      }
    } else {
      try {
        setSaving(true);
        // Генерируем секрет
        const secretData = await api('/api/users/me/2fa/generate', 'POST');
        
        // Показываем QR код и просим ввести код для подтверждения
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(secretData.otpauth)}`;
        const confirmed = confirm(
          `Отсканируйте QR код в приложении-аутентификаторе (Google Authenticator, Authy и т.д.):\n\n` +
          `QR код: ${qrCodeUrl}\n\n` +
          `Или введите секрет вручную: ${secretData.secret}\n\n` +
          `После настройки введите код из приложения для активации.`
        );
        
        if (!confirmed) {
          setSaving(false);
          return;
        }
        
        const code = prompt('Введите код из приложения-аутентификатора для активации:');
        if (!code) {
          setSaving(false);
          return;
        }
        
        // Включаем 2FA
        await api('/api/users/me/2fa/enable', 'POST', {
          secret: secretData.secret,
          code: code
        });
        
        setSecurity(prev => ({ ...prev, twoFactorEnabled: true }));
        setSaveStatus('success');
        setTimeout(() => setSaveStatus(null), 2000);
      } catch (e: any) {
        alert('Ошибка: ' + (e.message || 'Неверный код или ошибка активации'));
        setSaveStatus('error');
        setTimeout(() => setSaveStatus(null), 2000);
      } finally {
        setSaving(false);
      }
    }
  };

  const testSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGm98OSdTgwOUKrn8LZjGwU4ktjyy3krBSV3yPDdkD8KFF+z6eunVhQKRp/g8r1sIQQrgc7y2Yk1BxdpvfDjnU4MDlGq5/C2YxoFN5LY8st5KgUld8jw3ZA/ChRfs+nrp1YUCkaf4PK9bCEEK4HO8tmJNQcXab3w451ODA5RqufwtmMaBTeS2PLLeSoFJXfI8N2QPwoUX7Pp66dWFApGn+DyvWwhBCuBzvLZiTUHF2m98OOdTgwOUarn8LZjGgU3ktjyy3kqBSV3yPDdkD8KFF+z6eunVhQKRp/g8r1sIQQrgc7y2Yk1BxdpvfDjnU4MDlGq5/C2YxoFN5LY8st5KgUld8jw3ZA/ChRfs+nrp1YUCkaf4PK9bCEEK4HO8tmJNQcXab3w451ODA5RqufwtmMaBTeS2PLLeSoFJXfI8N2QPwoUX7Pp66dWFApGn+DyvWwhBCuBzvLZiTUHF2m98OOdTgwOUarn8LZjGgU3ktjyy3kqBSV3yPDdkD8KFF+z6eunVhQKRp/g8r1sIQQrgc7y2Yk1BxdpvfDjnU4MDlGq5/C2YxoFN5LY8st5KgUld8jw3ZA/ChRfs+nrp1YUCkaf4PK9bCEEK4HO8tmJNQcXab3w451ODA5RqufwtmMaBTeS2PLLeSoFJXfI8N2QPwoUX7Pp66dWFApGn+DyvWwhBCuBzvLZiTUHF2m98OOdTgwOUarn8LZjGgU3ktjyy3kqBSV3yPDdkD8KFF+z6eunVhQKRp/g8r1sIQQrgc7y2Yk1BxdpvfDjnU4MDlGq5/C2YxoFN5LY8st5KgUld8jw3ZA/ChRfs+nrp1YUCkaf4PK9bCEEK4HO8tmJNQcXab3w451ODA5RqufwtmMaBTeS2PLLeSoFJXfI8N2QPwoUX7Pp66dWFApGn+DyvWwhBCuBzvLZiTUHF2m98OOdTgwOUarn8LZjGgU3ktjyy3kqBSV3yPDdkD8KFF+z6eunVhQKRp/g8r1sIQQrgc7y2Yk1BxdpvfDjnU4MDlGq5/C2YxoFN5LY8st5KgUld8jw3ZA/ChRfs+nrp1YUCkaf4PK9bCEEK4HO8tmJNQcXab3w451ODA5RqufwtmMaBTeS2PLLeSoFJXfI8N2QPwoUX7Pp66dWFApGn+DyvWwhBCuBzvLZiTUHF2m98OOdTgwOUarn8LZjGgU3ktjyy3kqBSV3yPDdkD8KFF+z6eunVhQKRp/g8r1sIQQrgc7y2Yk1BxdpvfDjnU4MDlGq5/C2YxoFN5LY8st5KgUld8jw3ZA/');
    audio.volume = notifications.soundVolume / 100;
    audio.play().catch(() => {});
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>Настройки</h1>
        {saveStatus === 'success' && (
          <div className="settings-status success">✓ Сохранено</div>
        )}
        {saveStatus === 'error' && (
          <div className="settings-status error">✗ Ошибка сохранения</div>
        )}
      </div>

      <div className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          🔔 Уведомления
        </button>
        <button
          className={`settings-tab ${activeTab === 'privacy' ? 'active' : ''}`}
          onClick={() => setActiveTab('privacy')}
        >
          🔒 Приватность
        </button>
        <button
          className={`settings-tab ${activeTab === 'themes' ? 'active' : ''}`}
          onClick={() => setActiveTab('themes')}
        >
          🎨 Темы
        </button>
        <button
          className={`settings-tab ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          🛡️ Безопасность
        </button>
        <button
          className={`settings-tab ${activeTab === 'appearance' ? 'active' : ''}`}
          onClick={() => setActiveTab('appearance')}
        >
          🖼️ Внешний вид
        </button>
      </div>

      <div className="settings-content">
        {activeTab === 'notifications' && (
          <div className="settings-section">
            <h2>Уведомления</h2>
            
            <div className="settings-group">
              <h3>Общие</h3>
              <label className="settings-item">
                <div className="settings-item-label">
                  <span>Push-уведомления</span>
                  <span className="settings-item-description">Получать уведомления в браузере</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.pushEnabled}
                  onChange={e => {
                    if (e.target.checked) {
                      requestNotificationPermission();
                    } else {
                      setNotifications(prev => ({ ...prev, pushEnabled: false }));
                    }
                  }}
                  className="settings-toggle"
                />
              </label>

              <label className="settings-item">
                <div className="settings-item-label">
                  <span>Звуковые уведомления</span>
                  <span className="settings-item-description">Воспроизводить звук при новых сообщениях</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.soundEnabled}
                  onChange={e => setNotifications(prev => ({ ...prev, soundEnabled: e.target.checked }))}
                  className="settings-toggle"
                />
              </label>

              {notifications.soundEnabled && (
                <div className="settings-item">
                  <div className="settings-item-label">
                    <span>Громкость звука</span>
                    <span className="settings-item-description">{notifications.soundVolume}%</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={notifications.soundVolume}
                      onChange={e => setNotifications(prev => ({ ...prev, soundVolume: Number(e.target.value) }))}
                      style={{ flex: 1 }}
                    />
                    <button onClick={testSound} className="settings-button-small">🎵 Тест</button>
                  </div>
                </div>
              )}

              <label className="settings-item">
                <div className="settings-item-label">
                  <span>Уведомления на рабочем столе</span>
                  <span className="settings-item-description">Показывать системные уведомления</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.desktopEnabled}
                  onChange={e => setNotifications(prev => ({ ...prev, desktopEnabled: e.target.checked }))}
                  className="settings-toggle"
                />
              </label>

              <label className="settings-item">
                <div className="settings-item-label">
                  <span>Показывать превью</span>
                  <span className="settings-item-description">Показывать содержимое сообщения в уведомлении</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.previewEnabled}
                  onChange={e => setNotifications(prev => ({ ...prev, previewEnabled: e.target.checked }))}
                  className="settings-toggle"
                />
              </label>
            </div>

            <div className="settings-group">
              <h3>Типы чатов</h3>
              <label className="settings-item">
                <div className="settings-item-label">
                  <span>Уведомления из групп</span>
                  <span className="settings-item-description">Получать уведомления из групповых чатов</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.groupsEnabled}
                  onChange={e => setNotifications(prev => ({ ...prev, groupsEnabled: e.target.checked }))}
                  className="settings-toggle"
                />
              </label>

              <label className="settings-item">
                <div className="settings-item-label">
                  <span>Уведомления из каналов</span>
                  <span className="settings-item-description">Получать уведомления из каналов</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.channelsEnabled}
                  onChange={e => setNotifications(prev => ({ ...prev, channelsEnabled: e.target.checked }))}
                  className="settings-toggle"
                />
              </label>

              <label className="settings-item">
                <div className="settings-item-label">
                  <span>Только упоминания</span>
                  <span className="settings-item-description">Уведомления только при упоминании</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.mentionsOnly}
                  onChange={e => setNotifications(prev => ({ ...prev, mentionsOnly: e.target.checked }))}
                  className="settings-toggle"
                />
              </label>
            </div>

            <button
              onClick={saveNotifications}
              disabled={saving}
              className="settings-save-button"
            >
              {saving ? 'Сохранение...' : 'Сохранить настройки уведомлений'}
            </button>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="settings-section">
            <h2>Приватность и безопасность</h2>
            
            <div className="settings-group">
              <h3>Профиль</h3>
              <label className="settings-item">
                <div className="settings-item-label">
                  <span>Показывать био</span>
                  <span className="settings-item-description">Отображать информацию о себе другим пользователям</span>
                </div>
                <input
                  type="checkbox"
                  checked={privacy.showBio}
                  onChange={e => setPrivacy(prev => ({ ...prev, showBio: e.target.checked }))}
                  className="settings-toggle"
                />
              </label>

              <label className="settings-item">
                <div className="settings-item-label">
                  <span>Показывать аватар</span>
                  <span className="settings-item-description">Отображать фото профиля</span>
                </div>
                <input
                  type="checkbox"
                  checked={privacy.showAvatar}
                  onChange={e => setPrivacy(prev => ({ ...prev, showAvatar: e.target.checked }))}
                  className="settings-toggle"
                />
              </label>

              <label className="settings-item">
                <div className="settings-item-label">
                  <span>Показывать время последнего визита</span>
                  <span className="settings-item-description">Другие пользователи увидят, когда вы были в сети</span>
                </div>
                <input
                  type="checkbox"
                  checked={privacy.showLastSeen}
                  onChange={e => setPrivacy(prev => ({ ...prev, showLastSeen: e.target.checked }))}
                  className="settings-toggle"
                />
              </label>
            </div>

            <div className="settings-group">
              <h3>Сообщения</h3>
              <label className="settings-item">
                <div className="settings-item-label">
                  <span>Читаемые сообщения</span>
                  <span className="settings-item-description">Показывать галочки прочтения</span>
                </div>
                <input
                  type="checkbox"
                  checked={privacy.showReadReceipts}
                  onChange={e => setPrivacy(prev => ({ ...prev, showReadReceipts: e.target.checked }))}
                  className="settings-toggle"
                />
              </label>
            </div>

            <div className="settings-group">
              <h3>Группы и каналы</h3>
              <label className="settings-item">
                <div className="settings-item-label">
                  <span>Разрешить приглашения в группы</span>
                  <span className="settings-item-description">Другие пользователи смогут добавлять вас в группы</span>
                </div>
                <input
                  type="checkbox"
                  checked={privacy.allowGroupInvites}
                  onChange={e => setPrivacy(prev => ({ ...prev, allowGroupInvites: e.target.checked }))}
                  className="settings-toggle"
                />
              </label>
            </div>

            <div className="settings-group">
              <h3>Цвет профиля</h3>
              <div className="settings-item">
                <div className="settings-item-label">
                  <span>Выберите цвет</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  {['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'].map(color => (
                    <button
                      key={color}
                      onClick={() => setPrivacy(prev => ({ ...prev, profileColor: color }))}
                      className={`settings-color-button ${privacy.profileColor === color ? 'active' : ''}`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                  <input
                    type="color"
                    value={privacy.profileColor}
                    onChange={e => setPrivacy(prev => ({ ...prev, profileColor: e.target.value }))}
                    style={{ width: 40, height: 40, border: '2px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={savePrivacy}
              disabled={saving}
              className="settings-save-button"
            >
              {saving ? 'Сохранение...' : 'Сохранить настройки приватности'}
            </button>
          </div>
        )}

        {activeTab === 'themes' && (
          <div className="settings-section">
            <h2>Темы оформления</h2>
            <p className="settings-description">
              Выберите тему оформления для SafeGram. Вы можете создать свою собственную тему или выбрать из готовых.
            </p>
            <button
              onClick={() => setShowThemePicker(true)}
              className="settings-save-button"
            >
              🎨 Выбрать тему
            </button>
            {showThemePicker && (
              <div className="settings-modal-overlay" onClick={() => setShowThemePicker(false)}>
                <div className="settings-modal" onClick={e => e.stopPropagation()}>
                  <ThemePicker
                    onSelect={() => setShowThemePicker(false)}
                    onClose={() => setShowThemePicker(false)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'security' && (
          <div className="settings-section">
            <h2>Безопасность</h2>
            
            <div className="settings-group">
              <h3>Защита аккаунта</h3>
              <div className="settings-item">
                <div className="settings-item-label">
                  <span>Двухфакторная аутентификация</span>
                  <span className="settings-item-description">
                    {security.twoFactorEnabled 
                      ? 'Включена - дополнительная защита аккаунта активна'
                      : 'Дополнительная защита с помощью кода из приложения-аутентификатора'}
                  </span>
                </div>
                <button
                  onClick={toggleTwoFactor}
                  className={`settings-button ${security.twoFactorEnabled ? 'danger' : 'primary'}`}
                >
                  {security.twoFactorEnabled ? 'Отключить' : 'Включить'}
                </button>
              </div>

              <div className="settings-item">
                <div className="settings-item-label">
                  <span>PIN-код</span>
                  <span className="settings-item-description">
                    {security.pinEnabled 
                      ? 'Включен - требуется PIN для входа'
                      : 'Быстрая блокировка приложения с помощью PIN-кода'}
                  </span>
                </div>
                <button
                  onClick={() => alert('Настройка PIN будет доступна в следующих версиях')}
                  className={`settings-button ${security.pinEnabled ? 'danger' : 'primary'}`}
                >
                  {security.pinEnabled ? 'Отключить' : 'Включить'}
                </button>
              </div>
            </div>

            <div className="settings-group">
              <h3>Активные сессии</h3>
              <div className="settings-item">
                <div className="settings-item-label">
                  <span>Устройства</span>
                  <span className="settings-item-description">
                    Управление устройствами, на которых выполнен вход
                  </span>
                </div>
              </div>
              {security.activeSessions.length === 0 ? (
                <div className="settings-empty">
                  <p>Нет активных сессий</p>
                  <small>Все активные сессии будут отображаться здесь</small>
                </div>
              ) : (
                <div className="settings-sessions">
                  {security.activeSessions.map(session => (
                    <div key={session.id} className="settings-session-item">
                      <div>
                        <strong>{session.device}</strong>
                        <small>Последняя активность: {new Date(session.lastActivity).toLocaleString('ru-RU')}</small>
                      </div>
                      <button className="settings-button-small danger">Завершить</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="settings-section">
            <h2>Внешний вид</h2>
            
            <div className="settings-group">
              <h3>Интерфейс</h3>
              <div className="settings-item">
                <div className="settings-item-label">
                  <span>Компактный режим</span>
                  <span className="settings-item-description">Более компактное отображение элементов</span>
                </div>
                <label className="settings-toggle-wrapper">
                  <input type="checkbox" className="settings-toggle" />
                  <span className="settings-toggle-slider"></span>
                </label>
              </div>

              <div className="settings-item">
                <div className="settings-item-label">
                  <span>Показывать аватары в списке чатов</span>
                  <span className="settings-item-description">Отображать фото профилей в списке чатов</span>
                </div>
                <label className="settings-toggle-wrapper">
                  <input type="checkbox" defaultChecked className="settings-toggle" />
                  <span className="settings-toggle-slider"></span>
                </label>
              </div>

              <div className="settings-item">
                <div className="settings-item-label">
                  <span>Анимации</span>
                  <span className="settings-item-description">Включить плавные анимации интерфейса</span>
                </div>
                <label className="settings-toggle-wrapper">
                  <input type="checkbox" defaultChecked className="settings-toggle" />
                  <span className="settings-toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="settings-group">
              <h3>Язык</h3>
              <div className="settings-item">
                <div className="settings-item-label">
                  <span>Язык интерфейса</span>
                </div>
                <select className="settings-select" defaultValue="ru">
                  <option value="ru">Русский</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
