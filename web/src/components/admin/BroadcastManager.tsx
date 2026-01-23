import React, { useState } from 'react';
import { api } from '../../services/api';
import { showToast } from '../Toast';
import { ConfirmModal } from '../Modal';
import { useTranslation } from '../../i18n';

interface BroadcastOptions {
  message: string;
  target: 'all' | 'premium' | 'free' | 'online' | 'offline';
  type: 'notification' | 'message' | 'email';
  priority: 'normal' | 'high';
  scheduled: boolean;
  scheduledTime?: number;
}

export default function BroadcastManager() {
  const { t } = useTranslation();
  const [options, setOptions] = useState<BroadcastOptions>({
    message: '',
    target: 'all',
    type: 'notification',
    priority: 'normal',
    scheduled: false
  });
  const [sending, setSending] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [lastResult, setLastResult] = useState<{ sent: number; failed: number } | null>(null);

  const handleSend = async () => {
    try {
      setSending(true);
      const payload = {
        ...options,
        scheduledTime: options.scheduled && options.scheduledTime ? options.scheduledTime : undefined
      };
      
      const response = await api('/api/admin/broadcast', 'POST', payload);
      setLastResult(response);
      showToast(`Отправлено: ${response.sent}, Ошибок: ${response.failed}`, 'success');
      setConfirmModal(false);
      setOptions({
        message: '',
        target: 'all',
        type: 'notification',
        priority: 'normal',
        scheduled: false
      });
    } catch (e: any) {
      showToast('Ошибка отправки: ' + e.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const getTargetDescription = () => {
    switch (options.target) {
      case 'all': return 'всем пользователям';
      case 'premium': return 'Premium пользователям';
      case 'free': return 'бесплатным пользователям';
      case 'online': return 'онлайн пользователям';
      case 'offline': return 'офлайн пользователям';
      default: return '';
    }
  };

  const getTypeDescription = () => {
    switch (options.type) {
      case 'notification': return 'Push-уведомление';
      case 'message': return 'Сообщение в чат';
      case 'email': return 'Email письмо';
      default: return '';
    }
  };

  return (
    <div>
      <h3 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>
        📢 Массовая рассылка
      </h3>

      {/* Форма рассылки */}
      <div style={{
        padding: '20px',
        background: 'var(--panel, rgba(31, 41, 55, 0.6))',
        borderRadius: '12px',
        border: '1px solid var(--border, #374151)',
        marginBottom: '24px'
      }}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>
            Тип рассылки:
          </label>
          <select
            value={options.type}
            onChange={e => setOptions({ ...options, type: e.target.value as BroadcastOptions['type'] })}
            style={{
              width: '100%',
              padding: '10px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: '#e9ecf5',
              marginBottom: '16px'
            }}
          >
            <option value="notification">🔔 Push-уведомление</option>
            <option value="message">💬 Сообщение в чат</option>
            <option value="email">📧 Email письмо</option>
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>
            Целевая аудитория:
          </label>
          <select
            value={options.target}
            onChange={e => setOptions({ ...options, target: e.target.value as BroadcastOptions['target'] })}
            style={{
              width: '100%',
              padding: '10px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: '#e9ecf5',
              marginBottom: '16px'
            }}
          >
            <option value="all">👥 Всем пользователям</option>
            <option value="premium">⭐ Premium пользователям</option>
            <option value="free">🆓 Бесплатным пользователям</option>
            <option value="online">🟢 Онлайн пользователям</option>
            <option value="offline">⚫ Офлайн пользователям</option>
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>
            Приоритет:
          </label>
          <select
            value={options.priority}
            onChange={e => setOptions({ ...options, priority: e.target.value as BroadcastOptions['priority'] })}
            style={{
              width: '100%',
              padding: '10px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: '#e9ecf5',
              marginBottom: '16px'
            }}
          >
            <option value="normal">Обычный</option>
            <option value="high">Высокий</option>
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>
            Сообщение:
          </label>
          <textarea
            value={options.message}
            onChange={e => setOptions({ ...options, message: e.target.value })}
            placeholder="Введите текст сообщения..."
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
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <input
            type="checkbox"
            checked={options.scheduled}
            onChange={e => setOptions({ ...options, scheduled: e.target.checked })}
          />
          <span>Запланировать отправку</span>
        </label>

        {options.scheduled && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
              Дата и время отправки:
            </label>
            <input
              type="datetime-local"
              onChange={e => {
                const timestamp = new Date(e.target.value).getTime();
                setOptions({ ...options, scheduledTime: timestamp });
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
        )}

        <button
          onClick={() => setConfirmModal(true)}
          disabled={!options.message.trim() || sending}
          style={{
            width: '100%',
            padding: '12px 24px',
            background: options.message.trim() && !sending ? 'var(--accent, #3b82f6)' : '#6b7280',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: options.message.trim() && !sending ? 'pointer' : 'not-allowed',
            fontWeight: '600',
            fontSize: '16px',
            opacity: options.message.trim() && !sending ? 1 : 0.6
          }}
        >
          {sending ? 'Отправка...' : '📤 Отправить рассылку'}
        </button>
      </div>

      {/* Результаты последней рассылки */}
      {lastResult && (
        <div style={{
          padding: '20px',
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '12px',
          marginBottom: '24px'
        }}>
          <h4 style={{ marginBottom: '12px', fontSize: '18px', fontWeight: '600' }}>
            ✅ Результаты последней рассылки
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>
                {lastResult.sent}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--subtle, #9ca3af)' }}>
                Успешно отправлено
              </div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
                {lastResult.failed}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--subtle, #9ca3af)' }}>
                Ошибок
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно подтверждения */}
      <ConfirmModal
        isOpen={confirmModal}
        onClose={() => setConfirmModal(false)}
        onConfirm={handleSend}
        title="Подтверждение рассылки"
        message={
          <div>
            <p style={{ marginBottom: '12px' }}>
              Вы собираетесь отправить <strong>{getTypeDescription()}</strong> <strong>{getTargetDescription()}</strong>.
            </p>
            <div style={{
              padding: '12px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              marginBottom: '12px'
            }}>
              <strong>Сообщение:</strong>
              <div style={{ marginTop: '8px', whiteSpace: 'pre-wrap' }}>{options.message}</div>
            </div>
            <p style={{ color: '#f59e0b', fontSize: '14px' }}>
              ⚠️ Это действие нельзя отменить. Убедитесь, что сообщение корректно.
            </p>
          </div>
        }
        confirmText="Отправить"
        cancelText="Отмена"
        confirmColor="primary"
      />
    </div>
  );
}
