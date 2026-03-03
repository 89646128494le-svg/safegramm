import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { showToast } from './Toast';

interface Session {
  id: string;
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  location?: string;
  lastUsed: number;
  createdAt: number;
  expiresAt: number;
}

interface SessionsManagerProps {
  onClose: () => void;
}

export default function SessionsManager({ onClose }: SessionsManagerProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await api('/api/users/me/sessions');
      setSessions(data.sessions || []);
      setCurrentSessionId(data.currentSessionId ?? null);
    } catch (e: any) {
      showToast('Ошибка загрузки сессий: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const terminateSession = async (sessionId: string) => {
    if (!confirm('Завершить эту сессию?')) return;
    try {
      await api(`/api/users/me/sessions/${sessionId}`, 'DELETE');
      showToast('Сессия завершена', 'success');
      await loadSessions();
    } catch (e: any) {
      showToast('Ошибка завершения сессии: ' + e.message, 'error');
    }
  };

  const terminateAllOther = async () => {
    if (!confirm('Завершить все другие сессии? Вы останетесь в текущей сессии.')) return;
    try {
      await api('/api/users/me/sessions/terminate-all', 'POST');
      showToast('Все другие сессии завершены', 'success');
      await loadSessions();
    } catch (e: any) {
      showToast('Ошибка завершения сессий: ' + e.message, 'error');
    }
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} дн назад`;
    
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getDeviceIcon = (device?: string): string => {
    switch (device) {
      case 'mobile': return '📱';
      case 'tablet': return '📱';
      case 'desktop': return '💻';
      default: return '🌐';
    }
  };

  const currentSession = currentSessionId ? sessions.find(s => s.id === currentSessionId) : null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '700px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        border: '1px solid var(--border)'
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-primary)' }}>Активные сессии</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              padding: '4px 8px'
            }}
          >
            ✕
          </button>
        </div>

        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px'
        }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Загрузка...
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Нет активных сессий
            </div>
          ) : (
            <>
              {sessions.length > 1 && (
                <button
                  onClick={terminateAllOther}
                  style={{
                    width: '100%',
                    padding: '12px',
                    marginBottom: '16px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Завершить все другие сессии
                </button>
              )}
              
              {sessions.map((session) => (
                <div
                  key={session.id}
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    position: 'relative'
                  }}
                >
                  {currentSession?.id === session.id && (
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'var(--accent-primary)',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}>
                      Текущая
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ fontSize: '24px' }}>{getDeviceIcon(session.device)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>
                        {session.device === 'mobile' ? 'Мобильное устройство' :
                         session.device === 'tablet' ? 'Планшет' :
                         session.device === 'desktop' ? 'Компьютер' : 'Веб-браузер'}
                      </div>
                      {session.ipAddress && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          IP: {session.ipAddress}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    <div>Последнее использование: {formatDate(session.lastUsed)}</div>
                    <div>Создана: {formatDate(session.createdAt)}</div>
                  </div>
                  
                  {session.userAgent && (
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-tertiary)',
                      padding: '8px',
                      borderRadius: '4px',
                      marginBottom: '8px',
                      wordBreak: 'break-all'
                    }}>
                      {session.userAgent}
                    </div>
                  )}
                  
                  {currentSession?.id !== session.id && (
                    <button
                      onClick={() => terminateSession(session.id)}
                      style={{
                        padding: '6px 12px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '6px',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}
                    >
                      Завершить сессию
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
