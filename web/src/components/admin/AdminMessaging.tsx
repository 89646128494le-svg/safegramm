import React, { useState } from 'react';
import { BellRing, Mail, Send, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../../services/api';
import { showToast } from '../Toast';
import SystemBannerManager from './SystemBannerManager';

type TabKey = 'personal' | 'banner';

export default function AdminMessaging() {
  const [activeTab, setActiveTab] = useState<TabKey>('personal');

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        borderRadius: 18,
        padding: 24,
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.14)',
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Mail size={26} />
          Письма и баннеры
        </h2>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          Управление адресными письмами и глобальными объявлениями для всех пользователей.
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 24,
          padding: 6,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 14,
          width: 'fit-content',
        }}
      >
        <TabButton
          active={activeTab === 'personal'}
          icon={<Mail size={16} />}
          label="Персональные письма"
          onClick={() => setActiveTab('personal')}
        />
        <TabButton
          active={activeTab === 'banner'}
          icon={<BellRing size={16} />}
          label="Системная панель"
          onClick={() => setActiveTab('banner')}
        />
      </div>

      {activeTab === 'personal' ? <PersonalEmailForm /> : <SystemBannerManager />}
    </div>
  );
}

function TabButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '11px 14px',
        background: active ? 'linear-gradient(135deg, #7c6cff, #3dd8ff)' : 'transparent',
        color: active ? '#fff' : 'var(--text-secondary)',
        border: 'none',
        borderRadius: 10,
        cursor: 'pointer',
        fontWeight: 700,
        fontSize: 14,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function PersonalEmailForm() {
  const [userId, setUserId] = useState('');
  const [message, setMessage] = useState('');
  const [actionText, setActionText] = useState('');
  const [actionLink, setActionLink] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendEmail = async () => {
    if (!userId.trim() || !message.trim()) {
      showToast('Заполните обязательные поля', 'warning');
      return;
    }

    setLoading(true);
    try {
      await api('/api/admin/send-email', 'POST', {
        userId: userId.trim(),
        message: message.trim(),
        actionText: actionText.trim() || undefined,
        actionLink: actionLink.trim() || undefined,
      });

      showToast('Письмо отправлено', 'success');
      setUserId('');
      setMessage('');
      setActionText('');
      setActionLink('');
    } catch (error: any) {
      showToast('Не удалось отправить письмо: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} style={{ display: 'grid', gap: 18 }}>
      <div
        style={{
          padding: 18,
          borderRadius: 16,
          background: 'rgba(124,108,255,0.08)',
          border: '1px solid rgba(124,108,255,0.18)',
          color: 'var(--text-secondary)',
          lineHeight: 1.55,
        }}
      >
        Здесь можно отправить письмо конкретному пользователю. Используйте это для важных уведомлений, ответов по кейсам и адресных инструкций.
      </div>

      <Field label="ID пользователя *">
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Введите ID пользователя"
          style={fieldStyle}
        />
      </Field>

      <Field label="Сообщение *">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Введите текст письма"
          rows={6}
          style={{ ...fieldStyle, minHeight: 150, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
        <Field label="Текст кнопки">
          <input
            type="text"
            value={actionText}
            onChange={(e) => setActionText(e.target.value)}
            placeholder="Например: Открыть"
            style={fieldStyle}
          />
        </Field>
        <Field label="Ссылка кнопки">
          <input
            type="text"
            value={actionLink}
            onChange={(e) => setActionLink(e.target.value)}
            placeholder="https://..."
            style={fieldStyle}
          />
        </Field>
      </div>

      <button
        type="button"
        onClick={handleSendEmail}
        disabled={loading || !userId.trim() || !message.trim()}
        style={{
          width: '100%',
          padding: '14px 18px',
          background: loading ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #7c6cff, #3dd8ff)',
          color: '#fff',
          border: 'none',
          borderRadius: 14,
          fontSize: 16,
          fontWeight: 700,
          cursor: loading || !userId.trim() || !message.trim() ? 'not-allowed' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          opacity: loading || !userId.trim() || !message.trim() ? 0.65 : 1,
        }}
      >
        {loading ? (
          <>
            <Loader2 size={18} className="spin" />
            Отправка...
          </>
        ) : (
          <>
            <Send size={18} />
            Отправить письмо
          </>
        )}
      </button>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 8 }}>
      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  color: 'var(--text-primary)',
  fontSize: 14,
};
