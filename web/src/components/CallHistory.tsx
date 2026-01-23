import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface Call {
  id: string;
  chatId: string;
  callerId: string;
  receiverId: string;
  type: 'voice' | 'video';
  status: 'completed' | 'missed' | 'declined' | 'cancelled';
  duration: number;
  startedAt: number;
  endedAt?: number;
  recordingUrl?: string;
  caller?: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  receiver?: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
}

interface CallHistoryProps {
  chatId?: string;
  onClose: () => void;
  currentUserId: string;
}

export default function CallHistory({ chatId, onClose, currentUserId }: CallHistoryProps) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [missedCalls, setMissedCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'missed'>('all');

  useEffect(() => {
    loadCallHistory();
    loadMissedCalls();
  }, [chatId]);

  const loadCallHistory = async () => {
    try {
      setLoading(true);
      const url = chatId ? `/api/calls?chatId=${chatId}` : '/api/calls';
      const data = await api(url);
      setCalls(data.calls || []);
    } catch (e: any) {
      console.error('Failed to load call history:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadMissedCalls = async () => {
    try {
      const data = await api('/api/calls/missed');
      setMissedCalls(data.calls || []);
    } catch (e: any) {
      console.error('Failed to load missed calls:', e);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Вчера';
    } else if (days < 7) {
      return date.toLocaleDateString('ru-RU', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }
  };

  const getCallTitle = (call: Call): string => {
    if (call.callerId === currentUserId) {
      return call.receiver?.username || 'Неизвестный';
    } else {
      return call.caller?.username || 'Неизвестный';
    }
  };

  const getCallIcon = (call: Call): string => {
    if (call.status === 'missed') return '📞❌';
    if (call.status === 'declined') return '📞🚫';
    if (call.type === 'video') return '📹';
    return '📞';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'missed': return '#ef4444';
      case 'declined': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const displayCalls = activeTab === 'all' ? calls : missedCalls;

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
        maxWidth: '600px',
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
          <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-primary)' }}>История звонков</h2>
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

        {/* Вкладки */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)'
        }}>
          <button
            onClick={() => setActiveTab('all')}
            style={{
              flex: 1,
              padding: '12px',
              background: activeTab === 'all' ? 'var(--bg-primary)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'all' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              fontWeight: activeTab === 'all' ? '600' : '400'
            }}
          >
            Все ({calls.length})
          </button>
          <button
            onClick={() => setActiveTab('missed')}
            style={{
              flex: 1,
              padding: '12px',
              background: activeTab === 'missed' ? 'var(--bg-primary)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'missed' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              fontWeight: activeTab === 'missed' ? '600' : '400'
            }}
          >
            Пропущенные ({missedCalls.length})
          </button>
        </div>

        {/* Список звонков */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px'
        }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Загрузка...
            </div>
          ) : displayCalls.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {activeTab === 'missed' ? 'Нет пропущенных звонков' : 'Нет истории звонков'}
            </div>
          ) : (
            displayCalls.map((call) => (
              <div
                key={call.id}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-tertiary)';
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-secondary)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '24px' }}>{getCallIcon(call)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: '4px'
                    }}>
                      <div style={{ 
                        fontSize: '14px', 
                        fontWeight: '600', 
                        color: 'var(--text-primary)' 
                      }}>
                        {getCallTitle(call)}
                      </div>
                      <div style={{ 
                        fontSize: '12px', 
                        color: 'var(--text-secondary)' 
                      }}>
                        {formatDate(call.startedAt)}
                      </div>
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      gap: '12px', 
                      alignItems: 'center',
                      fontSize: '12px',
                      color: 'var(--text-secondary)'
                    }}>
                      <span style={{ 
                        color: getStatusColor(call.status),
                        fontWeight: '500'
                      }}>
                        {call.status === 'completed' ? 'Завершен' :
                         call.status === 'missed' ? 'Пропущен' :
                         call.status === 'declined' ? 'Отклонен' : 'Отменен'}
                      </span>
                      {call.duration > 0 && (
                        <span>• {formatDuration(call.duration)}</span>
                      )}
                      {call.type === 'video' && (
                        <span>• Видео</span>
                      )}
                      {call.recordingUrl && (
                        <a
                          href={call.recordingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}
                        >
                          📼 Запись
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
