
import React, { useEffect, useState } from 'react';
import { api, getErrorMessage } from '../services/api';
import { playNotificationSound } from '../services/notifications';
import EnhancedThemePicker from '../components/EnhancedThemePicker';
import AppearanceSettings from '../components/AppearanceSettings';
import SessionsManager from '../components/SessionsManager';
import BackupManager from '../components/BackupManager';
import BotManager from '../components/BotManager';
import CalendarIntegration from '../components/CalendarIntegration';
import TodoIntegration from '../components/TodoIntegration';
import LanguageSelector from '../components/LanguageSelector';
import { useTranslation } from '../i18n';
import { useStore } from '../store/useStore';
import SafetyAssistant from '../components/SafetyAssistant';
import { clearLocalPin, hasLocalPin, setLocalPin } from '../services/pinLock';
import { downloadAndDecryptVaultRecord, listVaultRecords, removeVaultRecord, VaultRecord } from '../services/vault';
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
  soundType: 'default' | 'gentle' | 'classic' | 'modern' | 'soft' | 'alert' | 'bell' | 'chime' | 'pop' | 'ding' | 'whoosh' | 'bubble';
  // Разные звуки для разных типов
  soundMessage?: string;
  soundCall?: string;
  soundMention?: string;
  soundGroup?: string;
  soundChannel?: string;
  // Громкость для разных типов
  volumeMessage?: number;
  volumeCall?: number;
  volumeMention?: number;
  volumeGroup?: number;
  volumeChannel?: number;
  // Do Not Disturb
  dndEnabled?: boolean;
  dndStart?: string; // HH:mm
  dndEnd?: string; // HH:mm
  // Приоритеты
  priorityHigh?: boolean; // Высокий приоритет для всех уведомлений
}

interface PrivacySettings {
  showBio: boolean;
  showAvatar: boolean;
  showLastSeen: boolean;
  lastSeenPrivacy?: 'everyone' | 'contacts' | 'never';
  require2fa?: boolean;
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
  const [activeTab, setActiveTab] = useState<'notifications' | 'privacy' | 'themes' | 'security' | 'appearance' | 'safety' | 'tools'>('notifications');
  const { ui, setProxyUrl, setStealthMode } = useStore();
  const [proxyInput, setProxyInput] = useState('');
  const [showBackupManager, setShowBackupManager] = useState(false);
  const [notifications, setNotifications] = useState<NotificationSettings>({
    pushEnabled: true,
    soundEnabled: true,
    desktopEnabled: true,
    mentionsOnly: false,
    previewEnabled: true,
    groupsEnabled: true,
    channelsEnabled: true,
    soundVolume: 80,
    soundType: 'default',
    soundMessage: 'default',
    soundCall: 'alert',
    soundMention: 'alert',
    soundGroup: 'gentle',
    soundChannel: 'chime',
    volumeMessage: 80,
    volumeCall: 100,
    volumeMention: 100,
    volumeGroup: 60,
    volumeChannel: 60,
    dndEnabled: false,
    dndStart: '22:00',
    dndEnd: '08:00',
    priorityHigh: false
  });
  const [privacy, setPrivacy] = useState<PrivacySettings>({
    showBio: true,
    showAvatar: true,
    showLastSeen: true,
    lastSeenPrivacy: 'everyone',
    require2fa: false,
    showReadReceipts: true,
    allowGroupInvites: true,
    profileColor: '#3b82f6'
  });
  const [security, setSecurity] = useState<SecuritySettings>({
    twoFactorEnabled: false,
    pinEnabled: hasLocalPin(),
    activeSessions: []
  });
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [twoFASecretData, setTwoFASecretData] = useState<{ secret: string; url: string } | null>(null);
  const [twoFACodeInput, setTwoFACodeInput] = useState('');
  const [twoFAEnabling, setTwoFAEnabling] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showAppearanceSettings, setShowAppearanceSettings] = useState(false);
  const [showSessionsManager, setShowSessionsManager] = useState(false);
  const [showBotManager, setShowBotManager] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTodos, setShowTodos] = useState(false);
  const [vaultRecords, setVaultRecords] = useState<VaultRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null);
  const [user, setUser] = useState<any>(null);
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') || 'dark') as 'dark' | 'light';
  });

  useEffect(() => {
    loadSettings();
    loadUser();
    setVaultRecords(listVaultRecords());
  }, []);

  useEffect(() => {
    if (activeTab === 'tools') {
      setVaultRecords(listVaultRecords());
    }
  }, [activeTab]);

  // Поддержка старых настроек прокси: если когда‑то было сохранено — просто читаем и применяем, но отдельную вкладку больше не показываем.
  useEffect(() => {
    if (ui.proxyUrl) {
      setProxyInput(ui.proxyUrl);
    }
  }, [ui.proxyUrl]);

  const loadUser = async () => {
    try {
      const u = await api('/api/users/me');
      setUser(u);
      setSecurity(prev => ({
        ...prev,
        twoFactorEnabled: !!u.twoFactorEnabled,
        pinEnabled: hasLocalPin() || !!u.pinEnabled,
      }));
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

      // Загружаем настройки приватности (GET возвращает lastSeenPrivacy, require2fa)
      try {
        const privacyData = await api('/api/users/me/privacy');
        const lastSeen = (privacyData as any).lastSeenPrivacy ?? (privacyData as any).lastSeen ?? 'everyone';
        setPrivacy(prev => ({
          ...prev,
          ...privacyData,
          lastSeenPrivacy: lastSeen === 'everyone' || lastSeen === 'contacts' || lastSeen === 'never' ? lastSeen : 'everyone',
          showLastSeen: lastSeen !== 'never',
          require2fa: !!(privacyData as any).require2fa
        }));
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
      await api('/api/users/me/privacy', 'POST', {
        showBio: privacy.showBio,
        showAvatar: privacy.showAvatar,
        lastSeenPrivacy: privacy.lastSeenPrivacy ?? (privacy.showLastSeen ? 'everyone' : 'never'),
        require2fa: privacy.require2fa
      });
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
          alert(getErrorMessage(e, 'Неверный код. Проверьте и попробуйте снова.'));
          setSaveStatus('error');
          setTimeout(() => setSaveStatus(null), 2000);
        } finally {
          setSaving(false);
        }
      }
    } else {
      try {
        setSaving(true);
        const secretData = await api('/api/users/me/2fa/generate', 'POST');
        setTwoFASecretData(secretData);
        setTwoFACodeInput('');
        setShow2FASetup(true);
      } catch (e: any) {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus(null), 2000);
      } finally {
        setSaving(false);
      }
    }
  };

  const togglePinLock = async () => {
    if (security.pinEnabled) {
      if (!confirm('Отключить локальный PIN-замок приложения?')) return;
      clearLocalPin();
      setSecurity(prev => ({ ...prev, pinEnabled: false }));
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 2000);
      return;
    }

    const pin = (prompt('Введите новый PIN (4-12 символов):') || '').trim();
    if (!pin) return;
    if (pin.length < 4 || pin.length > 12) {
      alert('PIN должен быть длиной от 4 до 12 символов.');
      return;
    }
    const pinConfirm = (prompt('Повторите PIN:') || '').trim();
    if (pin !== pinConfirm) {
      alert('PIN-коды не совпадают.');
      return;
    }

    try {
      await setLocalPin(pin);
      // Серверный PIN для cloud-login: опционально, если пользователь введёт пароль
      const accountPassword = (prompt('Введите пароль аккаунта для установки облачного PIN (или оставьте пустым, чтобы пропустить):') || '').trim();
      if (accountPassword) {
        await api('/api/users/me/pin', 'POST', { password: accountPassword, pin });
      }
      setSecurity(prev => ({ ...prev, pinEnabled: true }));
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (e: any) {
      alert(getErrorMessage(e, 'Не удалось сохранить PIN.'));
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 2000);
    }
  };

  const refreshVaultRecords = () => {
    setVaultRecords(listVaultRecords());
  };

  const handleVaultDownload = async (record: VaultRecord) => {
    try {
      await downloadAndDecryptVaultRecord(record);
    } catch (e: any) {
      alert(getErrorMessage(e, 'Не удалось скачать или расшифровать файл Vault.'));
    }
  };

  const handleVaultRemove = (id: string) => {
    removeVaultRecord(id);
    refreshVaultRecords();
  };

  const confirm2FAEnable = async () => {
    if (!twoFASecretData) return;
    const code = twoFACodeInput.trim();
    if (!/^\d{6}$/.test(code)) {
      alert('Код 2FA должен состоять из 6 цифр.');
      return;
    }
    setTwoFAEnabling(true);
    try {
      await api('/api/users/me/2fa/enable', 'POST', {
        secret: twoFASecretData.secret,
        code
      });
      setSecurity(prev => ({ ...prev, twoFactorEnabled: true }));
      setShow2FASetup(false);
      setTwoFASecretData(null);
      setTwoFACodeInput('');
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (e: any) {
      alert(getErrorMessage(e, 'Неверный OTP-код. Проверьте время на устройстве и попробуйте снова.'));
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 2000);
    } finally {
      setTwoFAEnabling(false);
    }
  };

  const testSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGm98OSdTgwOUKrn8LZjGwU4ktjyy3krBSV3yPDdkD8KFF+z6eunVhQKRp/g8r1sIQQrgc7y2Yk1BxdpvfDjnU4MDlGq5/C2YxoFN5LY8st5KgUld8jw3ZA/ChRfs+nrp1YUCkaf4PK9bCEEK4HO8tmJNQcXab3w451ODA5RqufwtmMaBTeS2PLLeSoFJXfI8N2QPwoUX7Pp66dWFApGn+DyvWwhBCuBzvLZiTUHF2m98OOdTgwOUarn8LZjGgU3ktjyy3kqBSV3yPDdkD8KFF+z6eunVhQKRp/g8r1sIQQrgc7y2Yk1BxdpvfDjnU4MDlGq5/C2YxoFN5LY8st5KgUld8jw3ZA/ChRfs+nrp1YUCkaf4PK9bCEEK4HO8tmJNQcXab3w451ODA5RqufwtmMaBTeS2PLLeSoFJXfI8N2QPwoUX7Pp66dWFApGn+DyvWwhBCuBzvLZiTUHF2m98OOdTgwOUarn8LZjGgU3ktjyy3kqBSV3yPDdkD8KFF+z6eunVhQKRp/g8r1sIQQrgc7y2Yk1BxdpvfDjnU4MDlGq5/C2YxoFN5LY8st5KgUld8jw3ZA/ChRfs+nrp1YUCkaf4PK9bCEEK4HO8tmJNQcXab3w451ODA5RqufwtmMaBTeS2PLLeSoFJXfI8N2QPwoUX7Pp66dWFApGn+DyvWwhBCuBzvLZiTUHF2m98OOdTgwOUarn8LZjGgU3ktjyy3kqBSV3yPDdkD8KFF+z6eunVhQKRp/g8r1sIQQrgc7y2Yk1BxdpvfDjnU4MDlGq5/C2YxoFN5LY8st5KgUld8jw3ZA/ChRfs+nrp1YUCkaf4PK9bCEEK4HO8tmJNQcXab3w451ODA5RqufwtmMaBTeS2PLLeSoFJXfI8N2QPwoUX7Pp66dWFApGn+DyvWwhBCuBzvLZiTUHF2m98OOdTgwOUarn8LZjGgU3ktjyy3kqBSV3yPDdkD8KFF+z6eunVhQKRp/g8r1sIQQrgc7y2Yk1BxdpvfDjnU4MDlGq5/C2YxoFN5LY8st5KgUld8jw3ZA/ChRfs+nrp1YUCkaf4PK9bCEEK4HO8tmJNQcXab3w451ODA5RqufwtmMaBTeS2PLLeSoFJXfI8N2QPwoUX7Pp66dWFApGn+DyvWwhBCuBzvLZiTUHF2m98OOdTgwOUarn8LZjGgU3ktjyy3kqBSV3yPDdkD8KFF+z6eunVhQKRp/g8r1sIQQrgc7y2Yk1BxdpvfDjnU4MDlGq5/C2YxoFN5LY8st5KgUld8jw3ZA/');
    audio.volume = notifications.soundVolume / 100;
    audio.play().catch(() => {});
  };

  const { t } = useTranslation();

  return (
    <div className="settings-container">
      {show2FASetup && twoFASecretData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
          onClick={() => { setShow2FASetup(false); setTwoFASecretData(null); }}
        >
          <div
            style={{
              background: 'var(--panel-1, #1a1f35)',
              borderRadius: 16,
              padding: 24,
              maxWidth: 380,
              width: '100%',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 24px 48px rgba(0,0,0,0.4)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#e9ecf5' }}>Отсканируйте QR-код</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'rgba(233,236,245,0.7)' }}>
              Google Authenticator, Authy или другое приложение.
            </p>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(twoFASecretData.url)}`}
                alt="QR 2FA"
                width={220}
                height={220}
                style={{ borderRadius: 12, background: '#fff', padding: 8 }}
              />
            </div>
            <p style={{ fontSize: 11, color: 'rgba(233,236,245,0.6)', marginBottom: 12, wordBreak: 'break-all' }}>
              Секрет: {twoFASecretData.secret}
            </p>
            <input
              type="text"
              placeholder="Код из приложения (6 цифр)"
              value={twoFACodeInput}
              onChange={e => setTwoFACodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              style={{
                width: '100%',
                padding: '12px 14px',
                marginBottom: 12,
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.06)',
                color: '#e9ecf5',
                fontSize: 16
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => { setShow2FASetup(false); setTwoFASecretData(null); }}
                style={{
                  flex: 1,
                  padding: 12,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 10,
                  color: '#e9ecf5',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={confirm2FAEnable}
                disabled={twoFAEnabling || twoFACodeInput.length !== 6}
                style={{
                  flex: 1,
                  padding: 12,
                  background: twoFACodeInput.length === 6 ? 'linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%)' : 'rgba(124,108,255,0.3)',
                  border: 'none',
                  borderRadius: 10,
                  color: '#0a0e1a',
                  cursor: twoFACodeInput.length === 6 ? 'pointer' : 'not-allowed',
                  fontWeight: 700
                }}
              >
                {twoFAEnabling ? 'Проверка...' : 'Включить 2FA'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="settings-header">
        <h1>{t('settings.title')}</h1>
        <LanguageSelector />
        {saveStatus === 'success' && (
          <div className="settings-status success">✓ {t('common.success')}</div>
        )}
        {saveStatus === 'error' && (
          <div className="settings-status error">✗ {t('errors.unknownError')}</div>
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
        <button
          className={`settings-tab ${activeTab === 'safety' ? 'active' : ''}`}
          onClick={() => setActiveTab('safety')}
        >
          🧠 Safety&nbsp;AI
        </button>
        <button
          className={`settings-tab ${activeTab === 'tools' ? 'active' : ''}`}
          onClick={() => setActiveTab('tools')}
        >
          🔧 Инструменты
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
            </div>

            <div className="settings-group">
              <h3>📞 Звонки</h3>
              <p className="settings-item-description" style={{ marginBottom: 12, lineHeight: 1.5 }}>
                Разрешите уведомления и звук для сайта в браузере — тогда вы будете стабильно получать входящие звонки (в том числе в другой вкладке) и слышать собеседника. Рекомендуется не блокировать автовоспроизведение для SafeGram.
              </p>
              {typeof window !== 'undefined' && 'Notification' in window && (
                <button
                  type="button"
                  onClick={requestNotificationPermission}
                  style={{
                    padding: '10px 18px',
                    background: Notification.permission === 'granted' ? 'rgba(34, 197, 94, 0.2)' : 'var(--accent, #7c6cff)',
                    color: Notification.permission === 'granted' ? '#22c55e' : '#fff',
                    border: '1px solid ' + (Notification.permission === 'granted' ? '#22c55e' : 'transparent'),
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  {Notification.permission === 'granted' ? '✓ Уведомления разрешены' : 'Разрешить уведомления для звонков'}
                </button>
              )}
            </div>

            <div className="settings-group">
              <h3>Звук и тип</h3>
              {notifications.soundEnabled && (
                <>
                  <div className="settings-item">
                    <div className="settings-item-label">
                      <span>Общий тип звука</span>
                      <span className="settings-item-description">Используется по умолчанию для всех типов</span>
                    </div>
                    <select
                      value={notifications.soundType}
                      onChange={e => setNotifications(prev => ({ ...prev, soundType: e.target.value as any }))}
                      style={{ width: '100%', padding: '8px', marginTop: 8, borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e9ecf5' }}
                    >
                      <option value="default">По умолчанию</option>
                      <option value="gentle">Мягкий</option>
                      <option value="classic">Классический</option>
                      <option value="modern">Современный</option>
                      <option value="soft">Тихий</option>
                      <option value="alert">Предупреждающий</option>
                      <option value="bell">Колокольчик</option>
                      <option value="chime">Мелодичный звон</option>
                      <option value="pop">Короткий "поп"</option>
                      <option value="ding">Одиночный "динг"</option>
                      <option value="whoosh">Свист</option>
                      <option value="bubble">Пузырьки</option>
                    </select>
                  </div>
                  
                  <div className="settings-item">
                    <div className="settings-item-label">
                      <span>Звуки для разных событий</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ width: 120, fontSize: 13 }}>Сообщения:</span>
                        <select
                          value={notifications.soundMessage || 'default'}
                          onChange={e => setNotifications(prev => ({ ...prev, soundMessage: e.target.value as any }))}
                          style={{ flex: 1, padding: '6px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e9ecf5', fontSize: 13 }}
                        >
                          <option value="default">По умолчанию</option>
                          <option value="gentle">Мягкий</option>
                          <option value="pop">Короткий</option>
                          <option value="ding">Динг</option>
                        </select>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={notifications.volumeMessage || 80}
                          onChange={e => setNotifications(prev => ({ ...prev, volumeMessage: Number(e.target.value) }))}
                          style={{ width: 80 }}
                        />
                        <span style={{ width: 40, fontSize: 12 }}>{notifications.volumeMessage || 80}%</span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ width: 120, fontSize: 13 }}>Звонки:</span>
                        <select
                          value={notifications.soundCall || 'alert'}
                          onChange={e => setNotifications(prev => ({ ...prev, soundCall: e.target.value as any }))}
                          style={{ flex: 1, padding: '6px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e9ecf5', fontSize: 13 }}
                        >
                          <option value="alert">Предупреждающий</option>
                          <option value="bell">Колокольчик</option>
                          <option value="chime">Мелодичный</option>
                        </select>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={notifications.volumeCall || 100}
                          onChange={e => setNotifications(prev => ({ ...prev, volumeCall: Number(e.target.value) }))}
                          style={{ width: 80 }}
                        />
                        <span style={{ width: 40, fontSize: 12 }}>{notifications.volumeCall || 100}%</span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ width: 120, fontSize: 13 }}>Упоминания:</span>
                        <select
                          value={notifications.soundMention || 'alert'}
                          onChange={e => setNotifications(prev => ({ ...prev, soundMention: e.target.value as any }))}
                          style={{ flex: 1, padding: '6px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e9ecf5', fontSize: 13 }}
                        >
                          <option value="alert">Предупреждающий</option>
                          <option value="bell">Колокольчик</option>
                          <option value="whoosh">Свист</option>
                        </select>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={notifications.volumeMention || 100}
                          onChange={e => setNotifications(prev => ({ ...prev, volumeMention: Number(e.target.value) }))}
                          style={{ width: 80 }}
                        />
                        <span style={{ width: 40, fontSize: 12 }}>{notifications.volumeMention || 100}%</span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ width: 120, fontSize: 13 }}>Группы:</span>
                        <select
                          value={notifications.soundGroup || 'gentle'}
                          onChange={e => setNotifications(prev => ({ ...prev, soundGroup: e.target.value as any }))}
                          style={{ flex: 1, padding: '6px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e9ecf5', fontSize: 13 }}
                        >
                          <option value="gentle">Мягкий</option>
                          <option value="soft">Тихий</option>
                          <option value="default">По умолчанию</option>
                        </select>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={notifications.volumeGroup || 60}
                          onChange={e => setNotifications(prev => ({ ...prev, volumeGroup: Number(e.target.value) }))}
                          style={{ width: 80 }}
                        />
                        <span style={{ width: 40, fontSize: 12 }}>{notifications.volumeGroup || 60}%</span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ width: 120, fontSize: 13 }}>Каналы:</span>
                        <select
                          value={notifications.soundChannel || 'chime'}
                          onChange={e => setNotifications(prev => ({ ...prev, soundChannel: e.target.value as any }))}
                          style={{ flex: 1, padding: '6px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e9ecf5', fontSize: 13 }}
                        >
                          <option value="chime">Мелодичный</option>
                          <option value="bell">Колокольчик</option>
                          <option value="gentle">Мягкий</option>
                        </select>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={notifications.volumeChannel || 60}
                          onChange={e => setNotifications(prev => ({ ...prev, volumeChannel: Number(e.target.value) }))}
                          style={{ width: 80 }}
                        />
                        <span style={{ width: 40, fontSize: 12 }}>{notifications.volumeChannel || 60}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="settings-item">
                    <div className="settings-item-label">
                      <span>Общая громкость звука</span>
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
                </>
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

            <div className="settings-group">
              <h3>Режим "Не беспокоить"</h3>
              <label className="settings-item">
                <div className="settings-item-label">
                  <span>Включить Do Not Disturb</span>
                  <span className="settings-item-description">Не показывать уведомления в указанное время (кроме упоминаний)</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.dndEnabled || false}
                  onChange={e => setNotifications(prev => ({ ...prev, dndEnabled: e.target.checked }))}
                  className="settings-toggle"
                />
              </label>

              {notifications.dndEnabled && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Начало (ЧЧ:ММ)</label>
                    <input
                      type="time"
                      value={notifications.dndStart || '22:00'}
                      onChange={e => setNotifications(prev => ({ ...prev, dndStart: e.target.value }))}
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e9ecf5' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Конец (ЧЧ:ММ)</label>
                    <input
                      type="time"
                      value={notifications.dndEnd || '08:00'}
                      onChange={e => setNotifications(prev => ({ ...prev, dndEnd: e.target.value }))}
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e9ecf5' }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="settings-group">
              <h3>Дополнительно</h3>
              <label className="settings-item">
                <div className="settings-item-label">
                  <span>Высокий приоритет</span>
                  <span className="settings-item-description">Всегда показывать уведомления с высоким приоритетом</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.priorityHigh || false}
                  onChange={e => setNotifications(prev => ({ ...prev, priorityHigh: e.target.checked }))}
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

              <div className="settings-item">
                <div className="settings-item-label">
                  <span>Кому показывать время последнего визита</span>
                  <span className="settings-item-description">Никому / только контактам / всем</span>
                </div>
                <select
                  value={privacy.lastSeenPrivacy ?? (privacy.showLastSeen ? 'everyone' : 'never')}
                  onChange={e => setPrivacy(prev => ({
                    ...prev,
                    lastSeenPrivacy: e.target.value as 'everyone' | 'contacts' | 'never',
                    showLastSeen: e.target.value !== 'never'
                  }))}
                  className="settings-select"
                  style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, minWidth: 200 }}
                >
                  <option value="never">Никому</option>
                  <option value="contacts">Только контактам</option>
                  <option value="everyone">Всем</option>
                </select>
              </div>

              <label className="settings-item">
                <div className="settings-item-label">
                  <span>Требовать двухэтапную верификацию при входе с нового устройства</span>
                  <span className="settings-item-description">При включении 2FA станет обязательной при каждом входе</span>
                </div>
                <input
                  type="checkbox"
                  checked={!!privacy.require2fa}
                  onChange={e => setPrivacy(prev => ({ ...prev, require2fa: e.target.checked }))}
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
              <h3>Stealth Mode</h3>
              <label className="settings-item">
                <div className="settings-item-label">
                  <span>Скрытый режим 🥷</span>
                  <span className="settings-item-description">
                    Скрывает превью сообщений в уведомлениях и в списке чатов.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={ui.stealthMode}
                  onChange={e => setStealthMode(e.target.checked)}
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
              <EnhancedThemePicker onClose={() => setShowThemePicker(false)} />
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
                  onClick={togglePinLock}
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
                <button
                  onClick={() => setShowSessionsManager(true)}
                  className="settings-button primary"
                >
                  Управление сессиями
                </button>
              </div>
            </div>
            
            {showSessionsManager && (
              <SessionsManager onClose={() => setShowSessionsManager(false)} />
            )}
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="settings-section">
            <h2>Функции и инструменты</h2>
            
            <div className="settings-group">
              <h3>Экспорт и резервное копирование</h3>
              <div className="settings-item">
                <div className="settings-item-label">
                  <span>Резервное копирование</span>
                  <span className="settings-item-description">
                    Создайте резервную копию всех ваших чатов и сообщений
                  </span>
                </div>
                <button
                  onClick={() => setShowBackupManager(true)}
                  className="settings-button primary"
                >
                  💾 Управление резервными копиями
                </button>
              </div>
            </div>

            <div className="settings-group">
              <h3>Vault (шифрованные файлы)</h3>
              <div className="settings-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
                <div className="settings-item-label">
                  <span>Управление шифрованными вложениями</span>
                  <span className="settings-item-description">
                    Файлы шифруются на клиенте (AES-256-GCM) перед загрузкой.
                  </span>
                </div>
                {vaultRecords.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    В Vault пока нет файлов.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {vaultRecords.slice(0, 20).map((record) => (
                      <div
                        key={record.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '10px 12px',
                          border: '1px solid var(--border, rgba(255,255,255,0.12))',
                          borderRadius: 10,
                          background: 'var(--panel-2, rgba(255,255,255,0.03))',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {record.envelope.name}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {new Date(record.createdAt).toLocaleString('ru-RU')}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="settings-button primary"
                            onClick={() => handleVaultDownload(record)}
                          >
                            Скачать
                          </button>
                          <button
                            type="button"
                            className="settings-button danger"
                            onClick={() => handleVaultRemove(record.id)}
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="settings-group">
              <h3>Интеграции</h3>
              <div className="settings-item">
                <div className="settings-item-label">
                  <span>Боты</span>
                  <span className="settings-item-description">
                    Управление ботами для автоматизации
                  </span>
                </div>
                <button
                  onClick={() => setShowBotManager(true)}
                  className="settings-button primary"
                >
                  🤖 Управление ботами
                </button>
              </div>
              <div className="settings-item">
                <div className="settings-item-label">
                  <span>Календарь</span>
                  <span className="settings-item-description">
                    Управление событиями и напоминаниями
                  </span>
                </div>
                <button
                  onClick={() => setShowCalendar(true)}
                  className="settings-button primary"
                >
                  📅 Календарь
                </button>
              </div>
              <div className="settings-item">
                <div className="settings-item-label">
                  <span>Задачи</span>
                  <span className="settings-item-description">
                    Управление задачами и todo списками
                  </span>
                </div>
                <button
                  onClick={() => setShowTodos(true)}
                  className="settings-button primary"
                >
                  ✅ Задачи
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="settings-section">
            <h2>Внешний вид</h2>
            <p className="settings-description">
              Настройте размер шрифта, компактный режим, анимации и другие параметры интерфейса.
            </p>
            <button
              onClick={() => setShowAppearanceSettings(true)}
              className="settings-save-button"
            >
              🖼️ Настройки внешнего вида
            </button>
            {showAppearanceSettings && (
              <AppearanceSettings onClose={() => setShowAppearanceSettings(false)} />
            )}
          </div>
        )}

        {activeTab === 'safety' && (
          <div className="settings-section">
            <h2>Safety AI</h2>
            <p className="settings-description">
              Интеллектуальный ассистент для аудита безопасности, идей и подсказок прямо внутри SafeGram.
            </p>
            <div style={{ marginTop: 16 }}>
              <SafetyAssistant onClose={() => setActiveTab('notifications')} />
            </div>
          </div>
        )}
      </div>

      {/* Модальные окна для инструментов */}
      {showBackupManager && (
        <BackupManager onClose={() => setShowBackupManager(false)} />
      )}
      {showBotManager && (
        <BotManager onClose={() => setShowBotManager(false)} />
      )}
      {showCalendar && (
        <CalendarIntegration onClose={() => setShowCalendar(false)} />
      )}
      {showTodos && (
        <TodoIntegration onClose={() => setShowTodos(false)} />
      )}
    </div>
  );
}
