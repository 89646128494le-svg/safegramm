import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Send, Users, AlertTriangle, CheckCircle, XCircle, Loader } from 'lucide-react';
import { api } from '../../services/api';
import { showToast } from '../Toast';

export default function AdminMessaging() {
  const [activeTab, setActiveTab] = useState<'personal' | 'maintenance'>('personal');

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
    }}>
      <h2 style={{
        fontSize: '24px',
        fontWeight: 700,
        marginBottom: '24px',
        color: 'var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <Mail size={28} />
        Управление сообщениями
      </h2>

      {/* Табы */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        borderBottom: '2px solid var(--border)',
        paddingBottom: '0',
      }}>
        <button
          onClick={() => setActiveTab('personal')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'personal' ? 'var(--accent)' : 'transparent',
            color: activeTab === 'personal' ? '#fff' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            transition: 'all 0.2s',
          }}
        >
          📧 Персональные письма
        </button>
        <button
          onClick={() => setActiveTab('maintenance')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'maintenance' ? 'var(--accent)' : 'transparent',
            color: activeTab === 'maintenance' ? '#fff' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            transition: 'all 0.2s',
          }}
        >
          🔧 Технические работы
        </button>
      </div>

      {/* Контент табов */}
      {activeTab === 'personal' ? <PersonalEmailForm /> : <MaintenanceForm />}
    </div>
  );
}

// Форма для отправки персонального письма
function PersonalEmailForm() {
  const [userId, setUserId] = useState('');
  const [message, setMessage] = useState('');
  const [actionText, setActionText] = useState('');
  const [actionLink, setActionLink] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendEmail = async () => {
    if (!userId || !message) {
      showToast('Заполните все обязательные поля', 'warning');
      return;
    }

    setLoading(true);
    try {
      await api('/api/admin/send-email', 'POST', {
        userId,
        message,
        actionText: actionText || undefined,
        actionLink: actionLink || undefined,
      });

      showToast('Письмо успешно отправлено!', 'success');
      
      // Очищаем форму
      setUserId('');
      setMessage('');
      setActionText('');
      setActionLink('');
    } catch (error: any) {
      showToast('Ошибка отправки: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div style={{ marginBottom: '20px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}>
          ID пользователя *
        </label>
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Введите ID пользователя"
          style={{
            width: '100%',
            padding: '12px 16px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            fontSize: '14px',
          }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}>
          Сообщение *
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Введите текст сообщения..."
          rows={6}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        marginBottom: '24px',
      }}>
        <div>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}>
            Текст кнопки (опционально)
          </label>
          <input
            type="text"
            value={actionText}
            onChange={(e) => setActionText(e.target.value)}
            placeholder="Открыть"
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '14px',
            }}
          />
        </div>

        <div>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}>
            Ссылка кнопки (опционально)
          </label>
          <input
            type="text"
            value={actionLink}
            onChange={(e) => setActionLink(e.target.value)}
            placeholder="https://..."
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '14px',
            }}
          />
        </div>
      </div>

      <button
        onClick={handleSendEmail}
        disabled={loading || !userId || !message}
        style={{
          width: '100%',
          padding: '14px 24px',
          background: loading ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #7c6cff, #3dd8ff)',
          color: '#fff',
          border: 'none',
          borderRadius: '12px',
          fontSize: '16px',
          fontWeight: 600,
          cursor: loading || !userId || !message ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          opacity: loading || !userId || !message ? 0.6 : 1,
          transition: 'all 0.2s',
        }}
      >
        {loading ? (
          <>
            <Loader size={20} className="spin" />
            Отправка...
          </>
        ) : (
          <>
            <Send size={20} />
            Отправить письмо
          </>
        )}
      </button>
    </motion.div>
  );
}

// Форма для управления техническими работами
function MaintenanceForm() {
  const [timestamp, setTimestamp] = useState('');
  const [message, setMessage] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleActivateMaintenance = async () => {
    if (!timestamp || !message) {
      showToast('Заполните дату и сообщение', 'warning');
      return;
    }

    setLoading(true);
    try {
      const response = await api('/api/admin/maintenance', 'POST', {
        timestamp,
        message,
        sendEmail,
      });

      showToast(`Режим техработ успешно включён!${sendEmail ? ' Письма отправлены.' : ''}`, 'success');
      if (sendEmail && response.emailsSent) {
        showToast(`Отправлено писем: ${response.emailsSent}`, 'info');
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('maintenance-updated'));
        window.dispatchEvent(new Event('system-banner-updated'));
      }

      setTimestamp('');
      setMessage('');
      setSendEmail(false);
    } catch (error: any) {
      showToast('Ошибка включения: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDisableMaintenance = async () => {
    setLoading(true);
    try {
      await api('/api/admin/maintenance/disable', 'POST');
      showToast('Режим техработ отключён', 'success');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('maintenance-updated'));
        window.dispatchEvent(new Event('system-banner-updated'));
      }
    } catch (error: any) {
      showToast('Ошибка отключения: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div style={{
        background: 'rgba(255, 193, 7, 0.1)',
        border: '2px solid rgba(255, 193, 7, 0.3)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
      }}>
        <AlertTriangle size={24} color="#ffc107" style={{ flexShrink: 0 }} />
        <div>
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            ⚠️ Внимание!
          </p>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
            Активация режима технических работ отобразит баннер всем пользователям на сайте.
            {sendEmail && ' Также будет отправлено email-уведомление ВСЕМ зарегистрированным пользователям.'}
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}>
          Время проведения работ *
        </label>
        <input
          type="text"
          value={timestamp}
          onChange={(e) => setTimestamp(e.target.value)}
          placeholder="Например: 25 января 2024, с 02:00 до 04:00 (МСК)"
          style={{
            width: '100%',
            padding: '12px 16px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            fontSize: '14px',
          }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}>
          Описание работ *
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Во время работ доступ к сервису может быть ограничен..."
          rows={4}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          userSelect: 'none',
        }}>
          <input
            type="checkbox"
            checked={sendEmail}
            onChange={(e) => setSendEmail(e.target.checked)}
            style={{
              width: '18px',
              height: '18px',
              cursor: 'pointer',
            }}
          />
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
            Отправить email всем пользователям
          </span>
        </label>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
      }}>
        <button
          onClick={handleActivateMaintenance}
          disabled={loading || !timestamp || !message}
          style={{
            padding: '14px 24px',
            background: loading ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #ff9800, #f57c00)',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: loading || !timestamp || !message ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            opacity: loading || !timestamp || !message ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
        >
          {loading ? (
            <>
              <Loader size={20} className="spin" />
              Активация...
            </>
          ) : (
            <>
              <AlertTriangle size={20} />
              Активировать
            </>
          )}
        </button>

        <button
          onClick={handleDisableMaintenance}
          disabled={loading}
          style={{
            padding: '14px 24px',
            background: loading ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #22c55e, #16a34a)',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            opacity: loading ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
        >
          {loading ? (
            <>
              <Loader size={20} className="spin" />
              Отключение...
            </>
          ) : (
            <>
              <CheckCircle size={20} />
              Отключить
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

// Добавляем стили для анимации
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .spin {
    animation: spin 1s linear infinite;
  }
`;
document.head.appendChild(style);


