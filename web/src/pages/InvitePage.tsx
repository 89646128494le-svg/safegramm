import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../services/api';

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<{ inviterName?: string; questionnaire?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) {
      setError('Неверная ссылка');
      setLoading(false);
      return;
    }
    const base = getApiBaseUrl().replace(/\/+$/, '');
    const url = `${base}/api/invite/${code}`;
    fetch(url)
      .then((r) => {
        if (!r.ok) {
          if (r.status === 404 || r.status === 410) throw new Error('Ссылка недействительна или истекла');
          throw new Error('Ошибка загрузки');
        }
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message || 'Ошибка'))
      .finally(() => setLoading(false));
  }, [code]);

  const goToRegister = () => {
    if (code) navigate(`/register?invite=${code}`);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0b1020 0%, #1a1f35 100%)', color: '#e2e8f0' }}>
        <div style={{ width: 28, height: 28, border: '2px solid rgba(124,108,255,0.3)', borderTopColor: '#7c6cff', borderRadius: '50%', animation: 'sg-spin 0.7s linear infinite' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'linear-gradient(135deg, #0b1020 0%, #1a1f35 100%)', color: '#e2e8f0' }}>
        <p style={{ marginBottom: 16, fontSize: 18 }}>{error}</p>
        <a href="/" style={{ color: 'var(--accent, #7c6cff)', textDecoration: 'underline' }}>На главную</a>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'linear-gradient(135deg, #0b1020 0%, #1a1f35 100%)', color: '#e2e8f0', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: 480, width: '100%', padding: 32, background: 'rgba(31, 41, 55, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
          {data?.inviterName ? `Вас пригласил ${data.inviterName}` : 'Вас пригласили в SafeGram'}
        </h1>
        {data?.questionnaire && (
          <div style={{ marginBottom: 24, textAlign: 'left', whiteSpace: 'pre-wrap', color: 'rgba(226, 232, 240, 0.9)', fontSize: 15, lineHeight: 1.5 }}>
            {data.questionnaire}
          </div>
        )}
        <p style={{ marginBottom: 24, color: 'rgba(226, 232, 240, 0.8)' }}>
          Перейдите по кнопке ниже, чтобы зарегистрироваться в мессенджере.
        </p>
        <button
          onClick={goToRegister}
          type="button"
          style={{ padding: '14px 28px', background: 'var(--accent, #7c6cff)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
        >
          Перейти к регистрации
        </button>
      </div>
    </div>
  );
}
