import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { showToast } from '../components/Toast';
import { Modal } from '../components/Modal';

interface Bot {
  id: string;
  username: string;
  name: string;
  description?: string;
  isActive?: boolean;
  createdAt?: string;
  token?: string;
}

const errorMessages: Record<string, string> = {
  username_taken: 'Этот username уже занят',
  username_invalid: 'Username: только латиница, цифры и подчёркивание',
  name_required: 'Введите имя бота',
  username_required: 'Введите username бота',
  bot_not_found: 'Бот не найден',
};

function getErrorMessage(e: any): string {
  const code = e?.errorCode || e?.error;
  if (code && errorMessages[code]) return errorMessages[code];
  return e?.message || 'Произошла ошибка';
}

export default function Bots() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [tokenTitle, setTokenTitle] = useState('Токен бота');
  const [createdToken, setCreatedToken] = useState('');
  const [newBot, setNewBot] = useState({ name: '', username: '', description: '' });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    loadBots();
  }, []);

  useEffect(() => {
    if (selectedBot) {
      setEditName(selectedBot.name);
      setEditDescription(selectedBot.description || '');
    }
  }, [selectedBot]);

  const loadBots = async () => {
    try {
      setLoading(true);
      const data = await api('/api/bots');
      setBots(data?.bots || []);
      if (selectedBot && !(data?.bots || []).some((b: Bot) => b.id === selectedBot.id)) {
        setSelectedBot(null);
      }
    } catch (e: any) {
      if (e?.status === 404) {
        setBots([]);
        return;
      }
      showToast(getErrorMessage(e), 'error');
      setBots([]);
    } finally {
      setLoading(false);
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
      const token = data.bot?.token || data.token || '';
      setCreatedToken(token);
      setTokenTitle('Токен бота — сохраните, он больше не покажется');
      setShowToken(true);
      showToast('Бот создан. Сохраните токен!', 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setCreating(false);
    }
  };

  const revokeToken = async () => {
    if (!selectedBot) return;
    if (!confirm('Выпустить новый токен? Старый перестанет работать.')) return;
    try {
      setRevoking(true);
      const data = await api(`/api/bots/${selectedBot.id}/revoke`, 'POST', {});
      setCreatedToken(data.bot?.token || '');
      setTokenTitle('Новый токен — сохраните, старый больше не действует');
      setShowToken(true);
      showToast('Токен обновлён', 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setRevoking(false);
    }
  };

  const saveEdit = async () => {
    if (!selectedBot) return;
    try {
      await api(`/api/bots/${selectedBot.id}`, 'PATCH', {
        name: editName.trim() || selectedBot.name,
        description: editDescription.trim(),
      });
      setSelectedBot({ ...selectedBot, name: editName.trim() || selectedBot.name, description: editDescription.trim() });
      await loadBots();
      setEditing(false);
      showToast('Бот обновлён', 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e), 'error');
    }
  };

  const toggleBot = async () => {
    if (!selectedBot) return;
    try {
      await api(`/api/bots/${selectedBot.id}/toggle`, 'POST', { isActive: !selectedBot.isActive });
      setSelectedBot({ ...selectedBot, isActive: !selectedBot.isActive });
      await loadBots();
      showToast(selectedBot.isActive ? 'Бот выключен' : 'Бот включён', 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e), 'error');
    }
  };

  const deleteBot = async () => {
    if (!selectedBot) return;
    if (!confirm('Удалить бота? Это нельзя отменить.')) return;
    try {
      await api(`/api/bots/${selectedBot.id}`, 'DELETE');
      setSelectedBot(null);
      await loadBots();
      showToast('Бот удалён', 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e), 'error');
    }
  };

  const copyToken = () => {
    navigator.clipboard.writeText(createdToken);
    showToast('Токен скопирован', 'success');
  };

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div className="empty">Загрузка...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: '700' }}>Боты</h2>
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
            fontSize: '14px',
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
              Имя бота <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              placeholder="Например: Мой помощник"
              value={newBot.name}
              onChange={(e) => setNewBot({ ...newBot, name: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--panel-2, #111827)',
                border: '1px solid var(--border, #374151)',
                borderRadius: '8px',
                color: 'var(--fg, #e5e7eb)',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
              Username (без @) <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              placeholder="mybot"
              value={newBot.username}
              onChange={(e) =>
                setNewBot({
                  ...newBot,
                  username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                })
              }
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--panel-2, #111827)',
                border: '1px solid var(--border, #374151)',
                borderRadius: '8px',
                color: 'var(--fg, #e5e7eb)',
              }}
            />
            <div className="small" style={{ marginTop: '4px', color: 'var(--subtle, #9ca3af)' }}>
              Только латиница, цифры и подчёркивание. Уникален в системе.
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Описание</label>
            <textarea
              placeholder="Описание бота..."
              value={newBot.description}
              onChange={(e) => setNewBot({ ...newBot, description: e.target.value })}
              rows={3}
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--panel-2, #111827)',
                border: '1px solid var(--border, #374151)',
                borderRadius: '8px',
                color: 'var(--fg, #e5e7eb)',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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
                cursor: 'pointer',
              }}
            >
              Отмена
            </button>
            <button
              onClick={createBot}
              disabled={creating || !newBot.name.trim() || !newBot.username.trim()}
              style={{
                padding: '10px 20px',
                background:
                  creating || !newBot.name.trim() || !newBot.username.trim()
                    ? '#6b7280'
                    : 'var(--accent, #3b82f6)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor:
                  creating || !newBot.name.trim() || !newBot.username.trim() ? 'not-allowed' : 'pointer',
                fontWeight: '600',
              }}
            >
              {creating ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showToken} onClose={() => setShowToken(false)} title={tokenTitle} size="small">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              padding: '12px',
              background: 'rgba(251, 191, 36, 0.1)',
              border: '1px solid rgba(251, 191, 36, 0.3)',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#fde047',
            }}
          >
            Сохраните токен в надёжном месте. В интерфейсе он больше не отобразится.
          </div>
          <div
            style={{
              padding: '12px',
              background: 'var(--panel-2, #111827)',
              border: '1px solid var(--border, #374151)',
              borderRadius: '8px',
              fontFamily: 'monospace',
              wordBreak: 'break-all',
              fontSize: '13px',
            }}
          >
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
              fontWeight: '600',
            }}
          >
            Скопировать токен
          </button>
        </div>
      </Modal>

      {bots.length === 0 ? (
        <div
          style={{
            padding: '48px',
            background: 'var(--panel, rgba(31, 41, 55, 0.6))',
            border: '1px solid var(--border, #374151)',
            borderRadius: '12px',
            textAlign: 'center',
          }}
        >
          <div className="empty">
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
            <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>У вас пока нет ботов</div>
            <div className="small" style={{ color: 'var(--subtle, #9ca3af)' }}>
              Создайте бота, получите токен и используйте его для API (как в Telegram BotFather).
            </div>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                marginTop: '16px',
                padding: '10px 20px',
                background: 'var(--accent, #3b82f6)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
              }}
            >
              Создать бота
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
          <div>
            <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>Мои боты</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {bots.map((bot) => (
                <div
                  key={bot.id}
                  onClick={() => setSelectedBot(bot)}
                  style={{
                    padding: '16px',
                    border: '1px solid var(--border, #374151)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    background:
                      selectedBot?.id === bot.id ? 'rgba(59, 130, 246, 0.2)' : 'var(--panel, rgba(31, 41, 55, 0.6))',
                    borderColor: selectedBot?.id === bot.id ? 'var(--accent, #3b82f6)' : 'var(--border, #374151)',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontWeight: '600', marginBottom: '4px', fontSize: '16px' }}>{bot.name}</div>
                  <div className="small" style={{ color: 'var(--subtle, #9ca3af)' }}>@{bot.username}</div>
                  {bot.description && (
                    <div
                      className="small"
                      style={{ marginTop: '8px', color: 'var(--subtle, #9ca3af)' }}
                    >
                      {bot.description.length > 50 ? bot.description.slice(0, 50) + '...' : bot.description}
                    </div>
                  )}
                  {bot.isActive === false && (
                    <div className="small" style={{ marginTop: '6px', color: '#ef4444' }}>Выключен</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {selectedBot ? (
            <div
              style={{
                padding: '24px',
                background: 'var(--panel, rgba(31, 41, 55, 0.6))',
                border: '1px solid var(--border, #374151)',
                borderRadius: '12px',
              }}
            >
              {editing ? (
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>Редактировать</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Имя"
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: 'var(--panel-2)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--fg)',
                      }}
                    />
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Описание"
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: 'var(--panel-2)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--fg)',
                        resize: 'vertical',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={saveEdit}
                        style={{
                          padding: '10px 20px',
                          background: 'var(--accent)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '600',
                        }}
                      >
                        Сохранить
                      </button>
                      <button
                        onClick={() => setEditing(false)}
                        style={{
                          padding: '10px 20px',
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          color: 'var(--fg)',
                          cursor: 'pointer',
                        }}
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>{selectedBot.name}</h3>
                    <div className="small" style={{ color: 'var(--subtle, #9ca3af)', marginBottom: '12px' }}>
                      @{selectedBot.username}
                    </div>
                    {selectedBot.description && (
                      <div style={{ color: 'var(--fg, #e5e7eb)', lineHeight: '1.6' }}>{selectedBot.description}</div>
                    )}
                  </div>

                  <div
                    style={{
                      padding: '16px',
                      background: 'var(--panel-2, #111827)',
                      border: '1px solid var(--border, #374151)',
                      borderRadius: '8px',
                      marginBottom: '16px',
                    }}
                  >
                    <div style={{ fontWeight: '600', marginBottom: '8px' }}>Токен</div>
                    <div className="small" style={{ color: 'var(--subtle, #9ca3af)', marginBottom: '12px' }}>
                      Токен не показывается после создания. Используйте «Отозвать и выдать новый», чтобы получить новый
                      токен (старый перестанет работать).
                    </div>
                    <button
                      onClick={revokeToken}
                      disabled={revoking}
                      style={{
                        padding: '8px 16px',
                        background: 'rgba(251, 191, 36, 0.2)',
                        border: '1px solid rgba(251, 191, 36, 0.4)',
                        borderRadius: '8px',
                        color: '#fde047',
                        cursor: revoking ? 'wait' : 'pointer',
                        fontSize: '14px',
                      }}
                    >
                      {revoking ? '...' : 'Отозвать и выдать новый токен'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <button
                      onClick={() => setEditing(true)}
                      style={{
                        padding: '8px 16px',
                        background: 'var(--accent, #3b82f6)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                      }}
                    >
                      Редактировать
                    </button>
                    <button
                      onClick={toggleBot}
                      style={{
                        padding: '8px 16px',
                        background: selectedBot.isActive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                        border: `1px solid ${selectedBot.isActive ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
                        color: selectedBot.isActive ? '#f87171' : '#4ade80',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                      }}
                    >
                      {selectedBot.isActive ? 'Выключить' : 'Включить'}
                    </button>
                    <button
                      onClick={deleteBot}
                      style={{
                        padding: '8px 16px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '14px',
                      }}
                    >
                      Удалить бота
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div
              style={{
                padding: '48px',
                background: 'var(--panel, rgba(31, 41, 55, 0.6))',
                border: '1px solid var(--border, #374151)',
                borderRadius: '12px',
                textAlign: 'center',
              }}
            >
              <div className="empty">
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>👉</div>
                <div style={{ fontSize: '18px', fontWeight: '600' }}>Выберите бота</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
