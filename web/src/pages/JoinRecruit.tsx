import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, getErrorMessage } from '../services/api';
import { showToast } from '../components/Toast';
import Header from '../components/Header';
import { useStore } from '../store/useStore';

export default function JoinRecruit() {
  const { user } = useStore();
  const [role, setRole] = useState<'tester' | 'helper'>('tester');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      showToast('Укажите email', 'error');
      return;
    }
    setLoading(true);
    try {
      await api('/api/recruit', 'POST', { email: email.trim(), name: name.trim(), role, message: message.trim() });
      setSent(true);
      setEmail('');
      setName('');
      setMessage('');
    } catch (err: any) {
      showToast(getErrorMessage(err, 'Не удалось отправить заявку. Попробуйте позже.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0b1020 0%, #1a1f35 100%)', color: '#e9ecf5' }}>
        <Header user={user} onLogout={() => {}} />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 520, margin: '80px auto', padding: 24, textAlign: 'center' }}>
          <h2 style={{ marginBottom: 16 }}>✅ Заявка отправлена</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Мы свяжемся с вами по указанному email.</p>
          <Link to="/" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>На главную</Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0b1020 0%, #1a1f35 100%)', color: '#e9ecf5' }}>
      <Header user={user} onLogout={() => {}} />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 520, margin: '48px auto', padding: 24 }}>
        <h1 style={{ marginBottom: 8, fontSize: 28 }}>Присоединиться к команде SafeGram</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Тестировщики и хелперы помогают делать продукт лучше. Оставьте заявку — мы напишем вам.</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label>
            <span style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>Роль</span>
            <select value={role} onChange={e => setRole(e.target.value as 'tester' | 'helper')} style={{ width: '100%', padding: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }}>
              <option value="tester">Тестировщик</option>
              <option value="helper">Хелпер (поддержка)</option>
            </select>
          </label>
          <label>
            <span style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>Email *</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" style={{ width: '100%', padding: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }} />
          </label>
          <label>
            <span style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>Имя или ник</span>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Как к вам обращаться" style={{ width: '100%', padding: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }} />
          </label>
          <label>
            <span style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>Коротко о себе или почему хотите помочь</span>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Необязательно" style={{ width: '100%', padding: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', resize: 'vertical' }} />
          </label>
          <button type="submit" disabled={loading} style={{ padding: 14, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, cursor: loading ? 'wait' : 'pointer' }}>
            {loading ? 'Отправка…' : 'Отправить заявку'}
          </button>
        </form>
        <p style={{ marginTop: 24, fontSize: 13, color: 'var(--text-secondary)' }}>
          <Link to="/" style={{ color: 'var(--accent)' }}>← На главную</Link>
        </p>
      </motion.div>
    </div>
  );
}
