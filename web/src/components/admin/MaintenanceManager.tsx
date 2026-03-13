import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Wrench } from 'lucide-react';
import { api } from '../../services/api';
import { showToast } from '../Toast';

interface MaintenanceResponse {
  enabled?: boolean;
  isActive?: boolean;
  message?: string;
  timestamp?: string;
  id?: string;
  createdAt?: string;
}

const DEFAULT_MESSAGE = 'Ведутся технические работы. Возможны временные ограничения части функций.';

export default function MaintenanceManager() {
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [timestamp, setTimestamp] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response: MaintenanceResponse = await api('/api/admin/maintenance');
      const nextEnabled = Boolean(response?.enabled ?? response?.isActive);
      setEnabled(nextEnabled);
      setMessage(response?.message || DEFAULT_MESSAGE);
      setTimestamp(response?.timestamp || '');
    } catch (error: any) {
      showToast('Не удалось загрузить техработы: ' + error.message, 'error');
      setEnabled(false);
      setMessage(DEFAULT_MESSAGE);
      setTimestamp('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const enableMaintenance = async () => {
    if (!message.trim() || !timestamp.trim()) {
      showToast('Заполните время и сообщение', 'warning');
      return;
    }
    setSaving(true);
    try {
      await api('/api/admin/maintenance', 'POST', {
        timestamp: timestamp.trim(),
        message: message.trim(),
        sendEmail,
      });
      setEnabled(true);
      showToast('Техработы включены', 'success');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('maintenance-updated'));
        window.dispatchEvent(new Event('system-banner-updated'));
      }
      await loadSettings();
    } catch (error: any) {
      showToast('Не удалось включить техработы: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const disableMaintenance = async () => {
    setSaving(true);
    try {
      await api('/api/admin/maintenance/disable', 'POST');
      setEnabled(false);
      showToast('Техработы отключены', 'success');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('maintenance-updated'));
        window.dispatchEvent(new Event('system-banner-updated'));
      }
      await loadSettings();
    } catch (error: any) {
      showToast('Не удалось отключить техработы: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="empty" style={{ padding: '48px' }}>Загрузка техработ...</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div
        style={{
          padding: 20,
          borderRadius: 18,
          background: enabled ? 'rgba(251,191,36,0.12)' : 'rgba(34,197,94,0.12)',
          border: enabled ? '1px solid rgba(251,191,36,0.22)' : '1px solid rgba(34,197,94,0.22)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--fg)', fontWeight: 700, marginBottom: 8 }}>
              {enabled ? <AlertTriangle size={20} color="#fbbf24" /> : <CheckCircle2 size={20} color="#34d399" />}
              {enabled ? 'Техработы активны' : 'Система работает в штатном режиме'}
            </div>
            <div style={{ color: 'var(--subtle)' }}>
              {enabled ? `Пользователи видят баннер техработ. ${timestamp ? `Время: ${timestamp}` : ''}` : 'Блокирующий баннер техработ сейчас выключен.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={enableMaintenance} disabled={saving} style={warningButtonStyle}>
              {saving ? <Loader2 size={18} className="spin" /> : <Wrench size={18} />}
              Включить
            </button>
            <button type="button" onClick={disableMaintenance} disabled={saving || !enabled} style={successButtonStyle}>
              <CheckCircle2 size={18} />
              Отключить
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: 20,
          borderRadius: 18,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'grid',
          gap: 16,
        }}
      >
        <div>
          <label style={labelStyle}>Время проведения</label>
          <input
            type="text"
            value={timestamp}
            onChange={(e) => setTimestamp(e.target.value)}
            placeholder="Например: 13 марта, с 02:00 до 04:00 МСК"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Сообщение для пользователей</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Опишите, какие функции могут быть ограничены."
            style={{ ...inputStyle, minHeight: 130, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--fg)', fontWeight: 600 }}>
          <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
          Отправить email-уведомление пользователям
        </label>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 8,
  color: 'var(--fg)',
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  background: 'var(--panel-2, #111827)',
  border: '1px solid var(--border, #374151)',
  borderRadius: 12,
  color: 'var(--fg, #e5e7eb)',
  fontSize: 14,
};

const warningButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 16px',
  background: 'linear-gradient(135deg, #f59e0b, #f97316)',
  color: '#fff',
  border: 'none',
  borderRadius: 12,
  cursor: 'pointer',
  fontWeight: 700,
};

const successButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 16px',
  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
  color: '#fff',
  border: 'none',
  borderRadius: 12,
  cursor: 'pointer',
  fontWeight: 700,
};
