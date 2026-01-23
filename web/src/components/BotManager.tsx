import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { showToast } from './Toast';

interface Bot {
  id: string;
  name: string;
  username: string;
  description?: string;
  commands: Array<{ command: string; description: string; handler: string }>;
  isActive: boolean;
  chatId?: string;
}

interface BotManagerProps {
  chatId?: string;
  onClose: () => void;
}

export default function BotManager({ chatId, onClose }: BotManagerProps) {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateBot, setShowCreateBot] = useState(false);
  const [newBot, setNewBot] = useState({
    name: '',
    username: '',
    description: '',
    commands: [] as Array<{ command: string; description: string; handler: string }>
  });

  useEffect(() => {
    loadBots();
  }, []);

  const loadBots = async () => {
    try {
      const data = await api('/api/bots');
      setBots(data.bots || []);
    } catch (e: any) {
      // Если API не существует, используем пустой список
      setBots([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBot = async () => {
    if (!newBot.name || !newBot.username) {
      showToast('Заполните имя и username бота', 'error');
      return;
    }

    try {
      await api('/api/bots', 'POST', {
        name: newBot.name,
        username: newBot.username,
        description: newBot.description,
        commands: newBot.commands,
        chatId: chatId
      });
      showToast('Бот создан', 'success');
      setShowCreateBot(false);
      setNewBot({ name: '', username: '', description: '', commands: [] });
      await loadBots();
    } catch (e: any) {
      showToast('Ошибка создания бота: ' + e.message, 'error');
    }
  };

  const handleToggleBot = async (botId: string, isActive: boolean) => {
    try {
      await api(`/api/bots/${botId}/toggle`, 'POST', { isActive: !isActive });
      showToast(isActive ? 'Бот деактивирован' : 'Бот активирован', 'success');
      await loadBots();
    } catch (e: any) {
      showToast('Ошибка: ' + e.message, 'error');
    }
  };

  const handleDeleteBot = async (botId: string) => {
    if (!confirm('Удалить этого бота?')) return;
    try {
      await api(`/api/bots/${botId}`, 'DELETE');
      showToast('Бот удален', 'success');
      await loadBots();
    } catch (e: any) {
      showToast('Ошибка удаления: ' + e.message, 'error');
    }
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
          <h2 style={{ margin: 0, fontSize: '24px', color: 'var(--text-primary)' }}>Управление ботами</h2>
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
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Загрузка...
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', color: 'var(--text-primary)' }}>Боты</h3>
                <button
                  onClick={() => setShowCreateBot(true)}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--accent-primary)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  + Создать бота
                </button>
              </div>

              {bots.length === 0 ? (
                <div style={{
                  padding: '40px',
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px'
                }}>
                  Нет ботов. Создайте первого бота для автоматизации.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {bots.map((bot) => (
                    <div
                      key={bot.id}
                      style={{
                        padding: '16px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '8px',
                        border: '1px solid var(--border)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '16px', color: 'var(--text-primary)' }}>
                            {bot.name} (@{bot.username})
                          </div>
                          {bot.description && (
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              {bot.description}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleToggleBot(bot.id, bot.isActive)}
                            style={{
                              padding: '6px 12px',
                              background: bot.isActive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                              border: `1px solid ${bot.isActive ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                              borderRadius: '6px',
                              color: bot.isActive ? '#ef4444' : '#10b981',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            {bot.isActive ? 'Деактивировать' : 'Активировать'}
                          </button>
                          <button
                            onClick={() => handleDeleteBot(bot.id)}
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
                      {bot.commands.length > 0 && (
                        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          Команды: {bot.commands.map(c => `/${c.command}`).join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Форма создания бота */}
              {showCreateBot && (
                <div style={{
                  marginTop: '24px',
                  padding: '16px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)'
                }}>
                  <h3 style={{ fontSize: '16px', marginBottom: '12px', color: 'var(--text-primary)' }}>
                    Создать бота
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input
                      type="text"
                      placeholder="Имя бота"
                      value={newBot.name}
                      onChange={e => setNewBot({ ...newBot, name: e.target.value })}
                      style={{
                        padding: '10px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)'
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Username бота (без @)"
                      value={newBot.username}
                      onChange={e => setNewBot({ ...newBot, username: e.target.value })}
                      style={{
                        padding: '10px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)'
                      }}
                    />
                    <textarea
                      placeholder="Описание бота"
                      value={newBot.description}
                      onChange={e => setNewBot({ ...newBot, description: e.target.value })}
                      style={{
                        padding: '10px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        minHeight: '80px',
                        resize: 'vertical'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={handleCreateBot}
                        style={{
                          flex: 1,
                          padding: '10px',
                          background: 'var(--accent-primary)',
                          border: 'none',
                          borderRadius: '8px',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        Создать
                      </button>
                      <button
                        onClick={() => {
                          setShowCreateBot(false);
                          setNewBot({ name: '', username: '', description: '', commands: [] });
                        }}
                        style={{
                          padding: '10px 20px',
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
