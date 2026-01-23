import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  createBackup, 
  saveBackupToLocal, 
  loadBackupsFromLocal, 
  exportBackupToFile, 
  importBackupFromFile 
} from '../utils/exportChatExtended';
import { showToast } from './Toast';

interface BackupManagerProps {
  onClose: () => void;
}

export default function BackupManager({ onClose }: BackupManagerProps) {
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [localBackups, setLocalBackups] = useState<Array<{ timestamp: number; data: string }>>([]);
  const [creatingBackup, setCreatingBackup] = useState(false);

  useEffect(() => {
    loadChats();
    loadLocalBackups();
  }, []);

  const loadChats = async () => {
    try {
      const data = await api('/api/chats');
      setChats(data.chats || []);
    } catch (e: any) {
      showToast('Ошибка загрузки чатов: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadLocalBackups = () => {
    const backups = loadBackupsFromLocal();
    setLocalBackups(backups);
  };

  const handleCreateBackup = async () => {
    try {
      setCreatingBackup(true);
      
      // Загружаем сообщения для всех чатов
      const allMessages: Record<string, any[]> = {};
      
      for (const chat of chats) {
        try {
          const messagesData = await api(`/api/chats/${chat.id}/messages?limit=10000`);
          allMessages[chat.id] = messagesData.messages || [];
        } catch (e) {
          console.warn(`Failed to load messages for chat ${chat.id}:`, e);
          allMessages[chat.id] = [];
        }
      }
      
      const backup = createBackup(chats, allMessages);
      saveBackupToLocal(backup);
      loadLocalBackups();
      showToast('Резервная копия создана', 'success');
    } catch (e: any) {
      showToast('Ошибка создания резервной копии: ' + e.message, 'error');
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleExportBackup = (backup: string, timestamp: number) => {
    const date = new Date(timestamp).toLocaleString('ru-RU').replace(/[^\d]/g, '_');
    exportBackupToFile(backup, `safegram_backup_${date}.json`);
    showToast('Резервная копия экспортирована', 'success');
  };

  const handleImportBackup = async (file: File) => {
    try {
      const backup = await importBackupFromFile(file);
      
      // Восстанавливаем чаты и сообщения
      if (backup.chats && Array.isArray(backup.chats)) {
        for (const chatData of backup.chats) {
          try {
            // Создаем или находим чат
            let chat;
            try {
              chat = await api(`/api/chats/${chatData.id}`);
            } catch {
              // Чат не существует, создаем
              chat = await api('/api/chats', 'POST', {
                type: chatData.type,
                name: chatData.name,
                memberIds: chatData.members?.map((m: any) => m.id) || []
              });
            }
            
            // Восстанавливаем сообщения
            if (chatData.messages && Array.isArray(chatData.messages)) {
              for (const msg of chatData.messages) {
                try {
                  await api(`/api/chats/${chat.id || chatData.id}/messages`, 'POST', {
                    text: msg.text,
                    attachmentUrl: msg.attachmentUrl
                  });
                } catch (e) {
                  console.warn(`Failed to restore message ${msg.id}:`, e);
                }
              }
            }
          } catch (e) {
            console.warn(`Failed to restore chat ${chatData.id}:`, e);
          }
        }
        
        showToast('Резервная копия восстановлена', 'success');
        await loadChats();
      } else {
        showToast('Неверный формат резервной копии', 'error');
      }
    } catch (e: any) {
      showToast('Ошибка импорта: ' + e.message, 'error');
    }
  };

  const handleDeleteBackup = (timestamp: number) => {
    if (!confirm('Удалить эту резервную копию?')) return;
    
    const backups = loadBackupsFromLocal();
    const filtered = backups.filter(b => b.timestamp !== timestamp);
    localStorage.setItem('safegram_backups', JSON.stringify(filtered));
    loadLocalBackups();
    showToast('Резервная копия удалена', 'success');
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('ru-RU');
  };

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
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '700px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        border: '1px solid var(--border)'
      }}>
        <div style={{
          padding: '24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '24px', color: 'var(--text-primary)' }}>Резервное копирование</h2>
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
          padding: '24px'
        }}>
          {/* Создание резервной копии */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '16px', color: 'var(--text-primary)' }}>
              Создать резервную копию
            </h3>
            <button
              onClick={handleCreateBackup}
              disabled={creatingBackup || loading}
              style={{
                width: '100%',
                padding: '12px',
                background: creatingBackup ? 'var(--bg-secondary)' : 'var(--accent-primary)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                cursor: creatingBackup ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              {creatingBackup ? '⏳ Создание...' : '💾 Создать резервную копию'}
            </button>
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              Будет сохранено: {chats.length} чатов
            </div>
          </div>

          {/* Локальные резервные копии */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '16px', color: 'var(--text-primary)' }}>
              Локальные резервные копии
            </h3>
            {localBackups.length === 0 ? (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                background: 'var(--bg-secondary)',
                borderRadius: '8px'
              }}>
                Нет локальных резервных копий
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {localBackups.map((backup) => (
                  <div
                    key={backup.timestamp}
                    style={{
                      padding: '12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                        {formatDate(backup.timestamp)}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {(JSON.parse(backup.data).chats || []).length} чатов
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleExportBackup(backup.data, backup.timestamp)}
                        style={{
                          padding: '6px 12px',
                          background: 'var(--accent-primary)',
                          border: 'none',
                          borderRadius: '6px',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        📥 Экспорт
                      </button>
                      <button
                        onClick={() => handleDeleteBackup(backup.timestamp)}
                        style={{
                          padding: '6px 12px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '6px',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Импорт резервной копии */}
          <div>
            <h3 style={{ fontSize: '18px', marginBottom: '16px', color: 'var(--text-primary)' }}>
              Восстановить из файла
            </h3>
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImportBackup(file);
                }
              }}
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '14px'
              }}
            />
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              Выберите файл резервной копии (.json) для восстановления
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
