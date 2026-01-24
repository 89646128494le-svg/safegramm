
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { showToast } from '../components/Toast';
import { Modal } from '../components/Modal';

interface Bot {
  id: string;
  username: string;
  name: string;
  description: string;
  token: string;
  commands: string[];
  webhookUrl?: string;
}

interface BotCommand {
  id: string;
  botId: string;
  command: string;
  description: string;
  handler: string;
}

export default function Bots() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [commands, setCommands] = useState<BotCommand[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [createdToken, setCreatedToken] = useState('');
  const [newBot, setNewBot] = useState({ name: '', username: '', description: '' });
  const [newCommand, setNewCommand] = useState({ command: '', description: '', handler: '' });
  const [loading, setLoading] = useState(true);
  const [commandsLoading, setCommandsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [addingCommand, setAddingCommand] = useState(false);

  useEffect(() => {
    loadBots();
  }, []);

  useEffect(() => {
    if (selectedBot) {
      loadCommands(selectedBot.id);
    } else {
      setCommands([]);
    }
  }, [selectedBot]);

  const loadBots = async () => {
    try {
      setLoading(true);
      const data = await api('/api/bots');
      setBots(data?.bots || []);
    } catch (e: any) {
      // Игнорируем 404 - эндпоинт еще не реализован
      if (e.status === 404 || e.errorCode === 'not_found') {
        setBots([]);
        return;
      }
      showToast('Ошибка загрузки ботов: ' + e.message, 'error');
      setBots([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCommands = async (botId: string) => {
    try {
      setCommandsLoading(true);
      const data = await api(`/api/bots/${botId}/commands`);
      setCommands(data.commands || []);
    } catch (e: any) {
      showToast('Ошибка загрузки команд: ' + e.message, 'error');
      setCommands([]);
    } finally {
      setCommandsLoading(false);
    }
  };

  const createBot = async () => {
    if (!newBot.name.trim()) {
      showToast('Введите имя бота', 'warning');
      return;
    }
    if (!newBot.username.trim()) {
      showToast('Введите username бота', 'warning');
      return;
    }

    try {
      setCreating(true);
      const data = await api('/api/bots', 'POST', newBot);
      await loadBots();
      setShowCreate(false);
      setNewBot({ name: '', username: '', description: '' });
      setCreatedToken(data.bot?.token || data.token || '');
      setShowToken(true);
      showToast('Бот создан успешно!', 'success');
    } catch (e: any) {
      showToast('Ошибка создания бота: ' + e.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const addCommand = async () => {
    if (!selectedBot) return;
    if (!newCommand.command.trim()) {
      showToast('Введите команду', 'warning');
      return;
    }
    if (!newCommand.handler.trim()) {
      showToast('Введите handler', 'warning');
      return;
    }

    try {
      setAddingCommand(true);
      await api(`/api/bots/${selectedBot.id}/commands`, 'POST', newCommand);
      await loadCommands(selectedBot.id);
      setNewCommand({ command: '', description: '', handler: '' });
      showToast('Команда добавлена', 'success');
    } catch (e: any) {
      showToast('Ошибка добавления команды: ' + e.message, 'error');
    } finally {
      setAddingCommand(false);
    }
  };

  const copyToken = () => {
    navigator.clipboard.writeText(createdToken);
    showToast('Токен скопирован в буфер обмена', 'success');
  };

  if (loading) {
    return (
      <div style={{padding: '48px', textAlign: 'center'}}>
        <div className="empty">Загрузка...</div>
      </div>
    );
  }

  return (
    <div style={{padding: '24px', maxWidth: 1200, margin: '0 auto'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
        <h2 style={{fontSize: '28px', fontWeight: '700'}}>Боты</h2>
        <button 
          onClick={() => setShowCreate(true)}
          style={{
            padding: '12px 24px',
            background: 'var(--accent, #3b82f6)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px'
          }}
        >
          + Создать бота
        </button>
      </div>

      <Modal
        isOpen={showCreate}
        onClose={() => {
          setShowCreate(false);
          setNewBot({ name: '', username: '', description: '' });
        }}
        title="Создать бота"
        size="medium"
      >
        <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
          <div>
            <label style={{display: 'block', marginBottom: '8px', fontWeight: '600'}}>
              Имя бота <span style={{color: '#ef4444'}}>*</span>
            </label>
            <input
              placeholder="Например: Мой помощник"
              value={newBot.name}
              onChange={e => setNewBot({...newBot, name: e.target.value})}
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--panel-2, #111827)',
                border: '1px solid var(--border, #374151)',
                borderRadius: '8px',
                color: 'var(--fg, #e5e7eb)'
              }}
            />
          </div>
          <div>
            <label style={{display: 'block', marginBottom: '8px', fontWeight: '600'}}>
              Username (без @) <span style={{color: '#ef4444'}}>*</span>
            </label>
            <input
              placeholder="mybot"
              value={newBot.username}
              onChange={e => setNewBot({...newBot, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')})}
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--panel-2, #111827)',
                border: '1px solid var(--border, #374151)',
                borderRadius: '8px',
                color: 'var(--fg, #e5e7eb)'
              }}
            />
          </div>
          <div>
            <label style={{display: 'block', marginBottom: '8px', fontWeight: '600'}}>
              Описание
            </label>
            <textarea
              placeholder="Описание бота..."
              value={newBot.description}
              onChange={e => setNewBot({...newBot, description: e.target.value})}
              rows={4}
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--panel-2, #111827)',
                border: '1px solid var(--border, #374151)',
                borderRadius: '8px',
                color: 'var(--fg, #e5e7eb)',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>
          <div style={{display: 'flex', gap: '8px', justifyContent: 'flex-end'}}>
            <button
              onClick={() => {
                setShowCreate(false);
                setNewBot({ name: '', username: '', description: '' });
              }}
              style={{
                padding: '10px 20px',
                background: 'transparent',
                border: '1px solid var(--border, #374151)',
                borderRadius: '8px',
                color: 'var(--fg, #e5e7eb)',
                cursor: 'pointer'
              }}
            >
              Отмена
            </button>
            <button
              onClick={createBot}
              disabled={creating || !newBot.name.trim() || !newBot.username.trim()}
              style={{
                padding: '10px 20px',
                background: (creating || !newBot.name.trim() || !newBot.username.trim()) ? '#6b7280' : 'var(--accent, #3b82f6)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: (creating || !newBot.name.trim() || !newBot.username.trim()) ? 'not-allowed' : 'pointer',
                fontWeight: '600'
              }}
            >
              {creating ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showToken}
        onClose={() => setShowToken(false)}
        title="Токен бота"
        size="small"
      >
        <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
          <div style={{
            padding: '12px',
            background: 'rgba(251, 191, 36, 0.1)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#fde047'
          }}>
            ⚠️ Сохраните токен! Он показывается только один раз.
          </div>
          <div style={{
            padding: '12px',
            background: 'var(--panel-2, #111827)',
            border: '1px solid var(--border, #374151)',
            borderRadius: '8px',
            fontFamily: 'monospace',
            wordBreak: 'break-all',
            fontSize: '13px'
          }}>
            {createdToken}
          </div>
          <button
            onClick={copyToken}
            style={{
              width: '100%',
              padding: '10px',
              background: 'var(--accent, #3b82f6)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            📋 Скопировать токен
          </button>
        </div>
      </Modal>

      {bots.length === 0 ? (
        <div style={{
          padding: '48px',
          background: 'var(--panel, rgba(31, 41, 55, 0.6))',
          border: '1px solid var(--border, #374151)',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <div className="empty">
            <div style={{fontSize: '48px', marginBottom: '16px'}}>🤖</div>
            <div style={{fontSize: '18px', fontWeight: '600', marginBottom: '8px'}}>У вас пока нет ботов</div>
            <div className="small" style={{color: 'var(--subtle, #9ca3af)'}}>
              Создайте первого бота, чтобы начать автоматизировать задачи
            </div>
          </div>
        </div>
      ) : (
        <div style={{display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px'}}>
          <div>
            <h3 style={{marginBottom: '16px', fontSize: '18px', fontWeight: '600'}}>Мои боты</h3>
            <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
              {bots.map(bot => (
                <div
                  key={bot.id}
                  onClick={() => setSelectedBot(bot)}
                  style={{
                    padding: '16px',
                    border: '1px solid var(--border, #374151)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    background: selectedBot?.id === bot.id ? 'rgba(59, 130, 246, 0.2)' : 'var(--panel, rgba(31, 41, 55, 0.6))',
                    borderColor: selectedBot?.id === bot.id ? 'var(--accent, #3b82f6)' : 'var(--border, #374151)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedBot?.id !== bot.id) {
                      e.currentTarget.style.borderColor = 'var(--accent, #3b82f6)';
                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedBot?.id !== bot.id) {
                      e.currentTarget.style.borderColor = 'var(--border, #374151)';
                      e.currentTarget.style.background = 'var(--panel, rgba(31, 41, 55, 0.6))';
                    }
                  }}
                >
                  <div style={{fontWeight: '600', marginBottom: '4px', fontSize: '16px'}}>{bot.name}</div>
                  <div className="small" style={{color: 'var(--subtle, #9ca3af)'}}>@{bot.username}</div>
                  {bot.description && (
                    <div className="small" style={{marginTop: '8px', color: 'var(--subtle, #9ca3af)'}}>
                      {bot.description.length > 50 ? bot.description.slice(0, 50) + '...' : bot.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {selectedBot ? (
            <div style={{
              padding: '24px',
              background: 'var(--panel, rgba(31, 41, 55, 0.6))',
              border: '1px solid var(--border, #374151)',
              borderRadius: '12px'
            }}>
              <div style={{marginBottom: '20px'}}>
                <h3 style={{fontSize: '24px', fontWeight: '700', marginBottom: '8px'}}>{selectedBot.name}</h3>
                <div className="small" style={{color: 'var(--subtle, #9ca3af)', marginBottom: '12px'}}>
                  @{selectedBot.username}
                </div>
                {selectedBot.description && (
                  <div style={{color: 'var(--fg, #e5e7eb)', lineHeight: '1.6'}}>
                    {selectedBot.description}
                  </div>
                )}
              </div>

              <div style={{
                padding: '16px',
                background: 'var(--panel-2, #111827)',
                border: '1px solid var(--border, #374151)',
                borderRadius: '8px',
                marginBottom: '24px'
              }}>
                <div style={{fontWeight: '600', marginBottom: '8px'}}>Токен бота</div>
                <div style={{
                  padding: '8px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  wordBreak: 'break-all',
                  color: 'var(--subtle, #9ca3af)'
                }}>
                  {selectedBot.token}
                </div>
                <div className="small" style={{marginTop: '8px', color: 'var(--subtle, #9ca3af)'}}>
                  Используйте этот токен для авторизации бота в API
                </div>
              </div>

              <div>
                <h4 style={{fontSize: '18px', fontWeight: '600', marginBottom: '16px'}}>Команды</h4>
                <div style={{
                  padding: '16px',
                  background: 'var(--panel-2, #111827)',
                  border: '1px solid var(--border, #374151)',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                    <input
                      placeholder="/команда (например: /help)"
                      value={newCommand.command}
                      onChange={e => setNewCommand({...newCommand, command: e.target.value})}
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: 'var(--bg, #0b0e13)',
                        border: '1px solid var(--border, #374151)',
                        borderRadius: '8px',
                        color: 'var(--fg, #e5e7eb)'
                      }}
                    />
                    <input
                      placeholder="Описание команды"
                      value={newCommand.description}
                      onChange={e => setNewCommand({...newCommand, description: e.target.value})}
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: 'var(--bg, #0b0e13)',
                        border: '1px solid var(--border, #374151)',
                        borderRadius: '8px',
                        color: 'var(--fg, #e5e7eb)'
                      }}
                    />
                    <input
                      placeholder="Handler (URL или код)"
                      value={newCommand.handler}
                      onChange={e => setNewCommand({...newCommand, handler: e.target.value})}
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: 'var(--bg, #0b0e13)',
                        border: '1px solid var(--border, #374151)',
                        borderRadius: '8px',
                        color: 'var(--fg, #e5e7eb)'
                      }}
                    />
                    <button
                      onClick={addCommand}
                      disabled={addingCommand || !newCommand.command.trim() || !newCommand.handler.trim()}
                      style={{
                        padding: '10px 16px',
                        background: (addingCommand || !newCommand.command.trim() || !newCommand.handler.trim()) ? '#6b7280' : '#22c55e',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: (addingCommand || !newCommand.command.trim() || !newCommand.handler.trim()) ? 'not-allowed' : 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      {addingCommand ? 'Добавление...' : '+ Добавить команду'}
                    </button>
                  </div>
                </div>

                {commandsLoading ? (
                  <div className="empty" style={{padding: '24px'}}>Загрузка команд...</div>
                ) : commands.length === 0 ? (
                  <div className="empty" style={{padding: '24px'}}>
                    Нет команд. Добавьте первую команду для вашего бота.
                  </div>
                ) : (
                  <div style={{display: 'grid', gap: '8px'}}>
                    {commands.map(cmd => (
                      <div 
                        key={cmd.id}
                        style={{
                          padding: '12px',
                          background: 'var(--panel-2, #111827)',
                          border: '1px solid var(--border, #374151)',
                          borderRadius: '8px'
                        }}
                      >
                        <div style={{fontWeight: '600', marginBottom: '4px', fontFamily: 'monospace'}}>
                          /{cmd.command}
                        </div>
                        {cmd.description && (
                          <div className="small" style={{marginBottom: '4px', color: 'var(--fg, #e5e7eb)'}}>
                            {cmd.description}
                          </div>
                        )}
                        <div className="small" style={{color: 'var(--subtle, #9ca3af)', fontFamily: 'monospace'}}>
                          Handler: {cmd.handler}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              padding: '48px',
              background: 'var(--panel, rgba(31, 41, 55, 0.6))',
              border: '1px solid var(--border, #374151)',
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <div className="empty">
                <div style={{fontSize: '48px', marginBottom: '16px'}}>👉</div>
                <div style={{fontSize: '18px', fontWeight: '600'}}>Выберите бота для просмотра</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
