import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { showToast } from '../../components/Toast';

export default function JoinServer() {
  const { link } = useParams<{ link: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!link) {
      setError('Неверная ссылка');
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        setLoading(true);
        const res = await api(`/api/servers/join/${link}`, 'POST');
        showToast('Вы присоединились к серверу', 'success');
        navigate(`/app/servers/${res.server.id}`);
      } catch (e: any) {
        setError(e.message || 'Ошибка');
        showToast('Ошибка: ' + (e.message || 'join failed'), 'error');
        setTimeout(() => navigate('/app/servers'), 1500);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [link, navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0b1020 0%, #1a1f35 100%)',
      color: '#e9ecf5'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '40px',
        background: 'rgba(11, 16, 32, 0.95)',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        {loading ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <h2>Присоединение к серверу...</h2>
          </>
        ) : error ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h2>Ошибка</h2>
            <div>{error}</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2>Готово</h2>
          </>
        )}
      </div>
    </div>
  );
}

