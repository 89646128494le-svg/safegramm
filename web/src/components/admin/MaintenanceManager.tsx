import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { showToast } from '../Toast';
import { useTranslation } from '../../i18n';

interface MaintenanceSettings {
  enabled: boolean;
  message: string;
  startTime?: number;
  endTime?: number;
  scheduled: boolean;
}

export default function MaintenanceManager() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<MaintenanceSettings>({
    enabled: false,
    message: 'Ведутся технические работы. Приносим извинения за неудобства.',
    scheduled: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await api('/api/admin/maintenance');
      setSettings(response);
    } catch (e: any) {
      showToast('Ошибка загрузки: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      await api('/api/admin/maintenance', 'POST', settings);
      showToast('Настройки сохранены', 'success');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('maintenance-updated'));
      }
    } catch (e: any) {
      showToast('Ошибка сохранения: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleMaintenance = async () => {
    const newSettings = { ...settings, enabled: !settings.enabled };
    if (newSettings.enabled) {
      newSettings.startTime = Date.now();
    } else {
      newSettings.endTime = Date.now();
    }
    setSettings(newSettings);
    try {
      setSaving(true);
      await api('/api/admin/maintenance', 'POST', newSettings);
      setSettings(newSettings);
      showToast(newSettings.enabled ? 'Техработы включены' : 'Техработы выключены', 'success');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('maintenance-updated'));
      }
    } catch (e: any) {
      showToast('Ошибка: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div className="empty">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>
        🔧 Управление техническими работами
      </h3>

      {/* Статус */}
      <div style={{
        padding: '20px',
        background: settings.enabled ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
        border: `1px solid ${settings.enabled ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
        borderRadius: '12px',
        marginBottom: '24px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>
              Статус: {settings.enabled ? '🔴 Технические работы включены' : '🟢 Система работает'}
            </div>
            {settings.enabled && settings.startTime && (
              <div style={{ fontSize: '14px', color: 'var(--subtle, #9ca3af)' }}>
                Начато: {new Date(settings.startTime).toLocaleString('ru-RU')}
              </div>
            )}
          </div>
          <button
            onClick={toggleMaintenance}
            disabled={saving}
            style={{
              padding: '12px 24px',
              background: settings.enabled ? '#22c55e' : '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              opacity: saving ? 0.6 : 1
            }}
          >
            {saving ? 'Сохранение...' : settings.enabled ? '✅ Выключить' : '🔴 Включить'}
          </button>
        </div>
      </div>

      {/* Настройки */}
      <div style={{
        padding: '20px',
        background: 'var(--panel, rgba(31, 41, 55, 0.6))',
        borderRadius: '12px',
        border: '1px solid var(--border, #374151)',
        marginBottom: '24px'
      }}>
        <h4 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
          Сообщение для пользователей
        </h4>
        <textarea
          value={settings.message}
          onChange={e => setSettings({ ...settings, message: e.target.value })}
          placeholder="Введите сообщение, которое увидят пользователи во время технических работ..."
          rows={6}
          style={{
            width: '100%',
            padding: '12px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            color: '#e9ecf5',
            fontSize: '14px',
            fontFamily: 'inherit',
            resize: 'vertical',
            marginBottom: '16px'
          }}
        />
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={saveSettings}
            disabled={saving}
            style={{
              padding: '10px 20px',
              background: 'var(--accent, #3b82f6)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              opacity: saving ? 0.6 : 1
            }}
          >
            {saving ? 'Сохранение...' : '💾 Сохранить'}
          </button>
          <button
            onClick={() => setSettings({
              ...settings,
              message: 'Ведутся технические работы. Приносим извинения за неудобства.'
            })}
            style={{
              padding: '10px 20px',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#e9ecf5',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            🔄 Сбросить
          </button>
        </div>
      </div>

      {/* Планирование */}
      <div style={{
        padding: '20px',
        background: 'var(--panel, rgba(31, 41, 55, 0.6))',
        borderRadius: '12px',
        border: '1px solid var(--border, #374151)'
      }}>
        <h4 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
          📅 Планирование технических работ
        </h4>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <input
            type="checkbox"
            checked={settings.scheduled}
            onChange={e => setSettings({ ...settings, scheduled: e.target.checked })}
          />
          <span>Включить запланированные технические работы</span>
        </label>
        {settings.scheduled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                Дата и время начала:
              </label>
              <input
                type="datetime-local"
                onChange={e => {
                  const timestamp = new Date(e.target.value).getTime();
                  setSettings({ ...settings, startTime: timestamp });
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#e9ecf5'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                Дата и время окончания:
              </label>
              <input
                type="datetime-local"
                onChange={e => {
                  const timestamp = new Date(e.target.value).getTime();
                  setSettings({ ...settings, endTime: timestamp });
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#e9ecf5'
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
