import React, { useState, useEffect } from 'react';
import { isOnline, onOnlineStatusChange, processOfflineQueue } from '../services/offlineQueue';
import { api } from '../services/api';
import { showToast } from './Toast';
import { useTranslation } from '../i18n';

interface ConnectionStatusProps {
  onSyncComplete?: (success: number, failed: number) => void;
}

export default function ConnectionStatus({ onSyncComplete }: ConnectionStatusProps) {
  const [online, setOnline] = useState(isOnline());
  const [syncing, setSyncing] = useState(false);
  const [pendingMessages, setPendingMessages] = useState(0);

  useEffect(() => {
    // Подписываемся на изменения статуса
    const unsubscribe = onOnlineStatusChange((isOnline) => {
      setOnline(isOnline);
      
      // При восстановлении связи синхронизируем очередь
      if (isOnline) {
        syncOfflineQueue();
      }
    });

    // Проверяем количество сообщений в очереди
    updatePendingCount();

    return unsubscribe;
  }, []);

  const updatePendingCount = () => {
    const { getOfflineQueue } = require('../services/offlineQueue');
    const queue = getOfflineQueue();
    setPendingMessages(queue.length);
  };

  const syncOfflineQueue = async () => {
    if (syncing) return;
    
    setSyncing(true);
    
    try {
      const result = await processOfflineQueue(async (message) => {
        // Отправляем сообщение через API
        await api(`/api/chats/${message.chatId}/messages`, 'POST', {
          text: message.text,
          attachmentUrl: message.attachmentUrl,
          replyToId: message.replyToId,
          type: message.type,
          ...message.data
        });
      });

      if (result.success > 0) {
        showToast(t('offline.syncComplete'), 'success');
      }
      
      if (result.failed > 0) {
        showToast(t('offline.syncFailed'), 'error');
      }

      updatePendingCount();
      
      if (onSyncComplete) {
        onSyncComplete(result.success, result.failed);
      }
    } catch (e: any) {
      console.error('Failed to sync offline queue:', e);
      showToast(t('offline.syncFailed'), 'error');
    } finally {
      setSyncing(false);
    }
  };

  if (online && pendingMessages === 0) {
    return null; // Не показываем индикатор, если все в порядке
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 10000,
        padding: '12px 16px',
        background: online ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)',
        color: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '14px',
        fontWeight: '500',
        backdropFilter: 'blur(10px)'
      }}
    >
      {online ? (
        <>
          {syncing ? (
            <>
              <div className="spinner" style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite'
              }} />
              <span>{t('offline.syncing')}</span>
            </>
          ) : pendingMessages > 0 ? (
            <>
              <span>📤</span>
              <span>{t('offline.pendingMessages', { count: pendingMessages })}</span>
              <button
                onClick={syncOfflineQueue}
                style={{
                  marginLeft: '8px',
                  padding: '4px 8px',
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                {t('offline.syncNow')}
              </button>
            </>
          ) : (
            <>
              <span>✓</span>
              <span>{t('offline.online')}</span>
            </>
          )}
        </>
      ) : (
        <>
          <span>⚠️</span>
          <span>{t('offline.offline')}</span>
        </>
      )}
    </div>
  );
}
