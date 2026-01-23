import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { showToast } from '../components/Toast';

export default function JoinChat() {
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

    const joinChat = async () => {
      try {
        setLoading(true);
        const response = await api(`/api/chats/join/${link}`, 'POST');
        showToast(response.message || 'Вы успешно присоединились к чату!', 'success');
        navigate(`/app/chats/${response.chat.id}`);
      } catch (e: any) {
        setError(e.message || 'Ошибка присоединения к чату');
        showToast('Ошибка: ' + (e.message || 'Не удалось присоединиться'), 'error');
        setTimeout(() => navigate('/app/chats'), 2000);
      } finally {
        setLoading(false);
      }
    };

    joinChat();
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
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
            <h2>Присоединение к чату...</h2>
          </>
        ) : error ? (
          <>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
            <h2>Ошибка</h2>
            <p>{error}</p>
            <p style={{ fontSize: '14px', color: 'rgba(233, 236, 245, 0.6)', marginTop: '20px' }}>
              Перенаправление на список чатов...
            </p>
          </>
        ) : (
          <>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>✅</div>
            <h2>Успешно!</h2>
            <p>Вы присоединились к чату</p>
          </>
        )}
      </div>
    </div>
  );
}
