import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { showToast } from '../Toast';
import { getErrorMessage } from '../../services/api';
import { UserPlus, Send, MessageCircle, Search, Loader } from 'lucide-react';

type UserItem = { id: string; username: string; email?: string };
type MessageItem = { id: string; senderId: string; text: string; createdAt: string; sender?: { id: string; username: string } };

export default function AnonymousDMTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [loadMessagesLoading, setLoadMessagesLoading] = useState(false);
  const [sendText, setSendText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const searchUsers = async () => {
    const q = searchQuery.trim();
    if (!q) {
      setUsers([]);
      return;
    }
    setSearchLoading(true);
    try {
      const data = await api(`/api/admin/users?search=${encodeURIComponent(q)}`);
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Ошибка поиска'), 'error');
      setUsers([]);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(searchUsers, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const loadChat = async (user: UserItem) => {
    setSelectedUser(user);
    setLoadMessagesLoading(true);
    setMessages([]);
    setChatId(null);
    try {
      const data = await api(`/api/admin/anonymous-chat/${user.id}`);
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setChatId(data.chat?.id ?? null);
    } catch (e: any) {
      const msg = e?.status === 404 ? 'Обновите сервер до последней версии для анонимных сообщений.' : getErrorMessage(e, 'Не удалось загрузить переписку');
      showToast(msg, 'error');
    } finally {
      setLoadMessagesLoading(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!selectedUser || !sendText.trim() || sending) return;
    setSending(true);
    try {
      const msg = await api('/api/admin/anonymous-dm', 'POST', {
        targetUserId: selectedUser.id,
        text: sendText.trim(),
      });
      setMessages((prev) => [...prev, msg]);
      setSendText('');
    } catch (e: any) {
      const msg = e?.status === 404 ? 'Обновите сервер до последней версии для анонимных сообщений.' : getErrorMessage(e, 'Ошибка отправки');
      showToast(msg, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '320px 1fr',
      gap: '24px',
      minHeight: '60vh',
      background: 'var(--panel, rgba(31, 41, 55, 0.6))',
      borderRadius: '12px',
      border: '1px solid var(--border, #374151)',
      overflow: 'hidden',
    }}>
      <div style={{
        borderRight: '1px solid var(--border, #374151)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserPlus size={22} />
          Найти пользователя
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--subtle, #9ca3af)', marginBottom: '8px' }}>
          Сообщения придут в чат «Анонимная поддержка». Пользователь не узнает, кто написал.
        </p>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--subtle)' }} />
          <input
            type="text"
            placeholder="Имя, email или ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 40px',
              background: 'var(--bg-secondary, #111827)',
              border: '1px solid var(--border, #374151)',
              borderRadius: '8px',
              color: 'var(--fg, #e5e7eb)',
              fontSize: '14px',
            }}
          />
        </div>
        {searchLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--subtle)' }}>
            <Loader size={18} className="spin" /> Поиск...
          </div>
        )}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => loadChat(u)}
              style={{
                padding: '12px',
                textAlign: 'left',
                background: selectedUser?.id === u.id ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                border: '1px solid ' + (selectedUser?.id === u.id ? 'var(--accent)' : 'var(--border)'),
                borderRadius: '8px',
                color: 'var(--fg)',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: '600' }}>{u.username}</div>
              {u.email && <div style={{ fontSize: '12px', color: 'var(--subtle)' }}>{u.email}</div>}
              <div style={{ fontSize: '11px', color: 'var(--subtle)' }}>ID: {u.id}</div>
            </button>
          ))}
          {!searchQuery.trim() && users.length === 0 && (
            <div style={{ fontSize: '13px', color: 'var(--subtle)' }}>Введите запрос для поиска</div>
          )}
        </div>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}>
        {!selectedUser ? (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--subtle)',
            gap: '12px',
          }}>
            <MessageCircle size={48} />
            <span>Выберите пользователя слева</span>
          </div>
        ) : (
          <>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              background: 'rgba(0,0,0,0.2)',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span>Пишете: {selectedUser.username}</span>
              <span style={{ fontSize: '12px', fontWeight: '400', color: 'var(--subtle)' }}>(пользователь видит «Поддержка»)</span>
            </div>
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              {loadMessagesLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--subtle)' }}>
                  <Loader size={20} className="spin" /> Загрузка...
                </div>
              ) : (
                <>
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: m.senderId === 'support' ? 'flex-end' : 'flex-start',
                        maxWidth: '80%',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        background: m.senderId === 'support'
                          ? 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)'
                          : 'var(--bg-secondary, #1f2937)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {m.senderId !== 'support' && (
                        <div style={{ fontSize: '11px', color: 'var(--subtle)', marginBottom: '4px' }}>
                          {m.sender?.username ?? selectedUser.username}
                        </div>
                      )}
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</div>
                      <div style={{ fontSize: '11px', color: 'var(--subtle)', marginTop: '4px' }}>
                        {new Date(m.createdAt).toLocaleString('ru-RU')}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
            <div style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-end',
            }}>
              <textarea
                value={sendText}
                onChange={(e) => setSendText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Сообщение от имени «Поддержка»..."
                rows={2}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--fg)',
                  fontSize: '14px',
                  resize: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={!sendText.trim() || sending}
                style={{
                  padding: '10px 20px',
                  background: sendText.trim() && !sending ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : 'var(--border)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: sendText.trim() && !sending ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {sending ? <Loader size={18} className="spin" /> : <Send size={18} />}
                Отправить
              </button>
            </div>
          </>
        )}
      </div>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>
    </div>
  );
}
