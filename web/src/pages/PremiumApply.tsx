import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, Send, ArrowLeft, CheckCircle } from 'lucide-react';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import Header from '../components/Header';

export default function PremiumApply() {
  const [searchParams] = useSearchParams();
  const plan = searchParams.get('plan') || 'premium';
  const planLabel = plan === 'enterprise' ? 'Enterprise' : plan === 'premium' ? 'Premium' : plan;
  const [reason, setReason] = useState('');
  const [extra, setExtra] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const nav = useNavigate();
  const { user, token } = useStore();

  const isAuth = !!(token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isAuth) {
      nav(`/login?redirect=${encodeURIComponent('/premium-apply')}&plan=${encodeURIComponent(plan)}`);
    }
  }, [isAuth, nav, plan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErr('Опишите, почему вам нужен тариф.');
      return;
    }
    setErr('');
    setLoading(true);
    try {
      const body = `План: ${planLabel}\n\nПочему вы хотите получить тариф:\n${reason.trim()}\n\n${extra.trim() ? 'Дополнительная информация:\n' + extra.trim() : ''}`;
      await api('/api/feedback', 'POST', {
        subject: `Заявка на тариф: ${planLabel}`,
        body
      });
      setSent(true);
    } catch (e: any) {
      setErr(e?.message || 'Не удалось отправить заявку.');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuth) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%)' }}>
        <div style={{ width: 32, height: 32, border: '2px solid rgba(124,108,255,0.3)', borderTopColor: '#7c6cff', borderRadius: '50%', animation: 'sg-spin 0.7s linear infinite' }} />
      </div>
    );
  }

  if (sent) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%)', color: '#e9ecf5' }}>
        <Header user={user} onLogout={() => {}} />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            maxWidth: '560px',
            margin: '0 auto',
            padding: '80px 24px',
            textAlign: 'center'
          }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(16,185,129,0.3), rgba(124,108,255,0.3))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px'
            }}
          >
            <CheckCircle size={40} color="#10b981" />
          </motion.div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '12px' }}>
            Заявка отправлена
          </h1>
          <p style={{ color: 'rgba(233,236,245,0.7)', marginBottom: '32px' }}>
            Мы рассмотрим вашу заявку на тариф {planLabel}. Решение появится в личном кабинете и по возможности будет отправлено на почту.
          </p>
          <Link
            to="/app/chats"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '14px 28px',
              background: 'linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%)',
              color: '#0a0e1a',
              borderRadius: '12px',
              fontWeight: 700,
              textDecoration: 'none'
            }}
          >
            Перейти в чаты
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%)', color: '#e9ecf5' }}>
      <Header user={user} onLogout={() => {}} />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          maxWidth: '600px',
          margin: '0 auto',
          padding: '80px 24px'
        }}
      >
        <Link
          to="/pricing"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: 'rgba(233,236,245,0.8)',
            textDecoration: 'none',
            marginBottom: '32px',
            fontSize: '14px'
          }}
        >
          <ArrowLeft size={18} /> Назад к тарифам
        </Link>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '8px'
        }}>
          <Star size={28} color="#7c6cff" />
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0 }}>
            Заявка на тариф {planLabel}
          </h1>
        </div>
        <p style={{ color: 'rgba(233,236,245,0.6)', marginBottom: '32px' }}>
          Заполните анкету. После рассмотрения заявки администрация выдаст или отклонит доступ к тарифу.
        </p>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
            Почему нам стоит выдать вам тариф {planLabel}? *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Опишите, зачем вам нужен этот тариф (использование, цели, объём и т.д.)"
            required
            rows={5}
            style={{
              width: '100%',
              padding: '14px 16px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '12px',
              color: '#e9ecf5',
              fontSize: '15px',
              resize: 'vertical',
              marginBottom: '20px',
              boxSizing: 'border-box'
            }}
          />
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
            Дополнительная информация
          </label>
          <textarea
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="Контакты, ссылки, комментарии (необязательно)"
            rows={3}
            style={{
              width: '100%',
              padding: '14px 16px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '12px',
              color: '#e9ecf5',
              fontSize: '15px',
              resize: 'vertical',
              marginBottom: '24px',
              boxSizing: 'border-box'
            }}
          />
          {err && (
            <p style={{ color: '#ef4444', marginBottom: '16px', fontSize: '14px' }}>{err}</p>
          )}
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 28px',
              background: 'linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%)',
              border: 'none',
              borderRadius: '12px',
              color: '#0a0e1a',
              fontWeight: 700,
              fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            <Send size={20} />
            {loading ? 'Отправка…' : 'Отправить заявку'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
