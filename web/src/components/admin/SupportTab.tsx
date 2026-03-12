import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, getErrorMessage } from '../../services/api';
import { showToast } from '../Toast';
import { Headset, Loader, MessageCircle, RefreshCw, Send, UserRound } from 'lucide-react';

type SupportTicket = {
  id: string;
  userId: string;
  subject: string;
  body: string;
  category?: string;
  priority?: string;
  status?: string;
  statusLabel?: string;
  chatId?: string;
  createdAt?: string;
  updatedAt?: string;
  lastReplyAt?: string;
  lastMessageAt?: string;
  user?: {
    id?: string;
    username?: string;
    email?: string;
  };
};

type SupportMessage = {
  id: string;
  senderId: string;
  text: string;
  createdAt?: string;
  sender?: {
    id?: string;
    username?: string;
  };
};

const STATUS_OPTIONS = [
  { value: 'open', label: 'Открыт' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'waiting_user', label: 'Ждём пользователя' },
  { value: 'resolved', label: 'Решён' },
  { value: 'closed', label: 'Закрыт' },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  general: 'Общий',
  bug: 'Баг',
  account: 'Аккаунт',
  security: 'Безопасность',
  billing: 'Оплата',
  premium: 'Тариф Premium',
  idea: 'Идея',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Низкий',
  normal: 'Обычный',
  high: 'Высокий',
  critical: 'Критический',
};

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  open: { background: 'rgba(59, 130, 246, 0.12)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.28)' },
  in_progress: { background: 'rgba(168, 85, 247, 0.12)', color: '#d8b4fe', border: '1px solid rgba(168, 85, 247, 0.28)' },
  waiting_user: { background: 'rgba(245, 158, 11, 0.12)', color: '#fcd34d', border: '1px solid rgba(245, 158, 11, 0.28)' },
  resolved: { background: 'rgba(34, 197, 94, 0.12)', color: '#86efac', border: '1px solid rgba(34, 197, 94, 0.28)' },
  closed: { background: 'rgba(148, 163, 184, 0.12)', color: '#cbd5e1', border: '1px solid rgba(148, 163, 184, 0.28)' },
};

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU');
}

export default function SupportTab() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [statusFilter, setStatusFilter] = useState('open');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) || null,
    [selectedTicketId, tickets]
  );

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const response = await api(`/api/admin/feedback${suffix}`);
      const items = Array.isArray(response?.tickets) ? response.tickets : [];
      setTickets(items);
      setSelectedTicketId((current) => {
        if (current && items.some((ticket: SupportTicket) => ticket.id === current)) {
          return current;
        }
        return items[0]?.id || '';
      });
    } catch (error: any) {
      showToast(getErrorMessage(error, 'Не удалось загрузить тикеты техподдержки.'), 'error');
      setTickets([]);
      setSelectedTicketId('');
    } finally {
      setLoadingTickets(false);
    }
  }, [categoryFilter, statusFilter]);

  const loadThread = useCallback(async (userId: string) => {
    setLoadingMessages(true);
    try {
      const response = await api(`/api/admin/anonymous-chat/${userId}`);
      const items = Array.isArray(response?.messages) ? response.messages : [];
      setMessages(items);
    } catch (error: any) {
      showToast(getErrorMessage(error, 'Не удалось загрузить переписку поддержки.'), 'error');
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (!selectedTicket?.userId) {
      setMessages([]);
      return;
    }
    loadThread(selectedTicket.userId);
  }, [loadThread, selectedTicket?.userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const patchTicketInList = useCallback((ticket: SupportTicket) => {
    setTickets((current) => current.map((item) => (item.id === ticket.id ? ticket : item)));
  }, []);

  const changeStatus = useCallback(async (nextStatus: string) => {
    if (!selectedTicket) return;
    setUpdatingStatus(true);
    try {
      const response = await api(`/api/admin/feedback/${selectedTicket.id}`, 'PATCH', { status: nextStatus });
      const nextTicket = response?.ticket as SupportTicket | undefined;
      if (nextTicket) {
        patchTicketInList(nextTicket);
      }
      await loadTickets();
      showToast('Статус тикета обновлён', 'success');
    } catch (error: any) {
      showToast(getErrorMessage(error, 'Не удалось обновить статус тикета.'), 'error');
    } finally {
      setUpdatingStatus(false);
    }
  }, [loadTickets, patchTicketInList, selectedTicket]);

  const sendReply = useCallback(async () => {
    if (!selectedTicket?.userId || !replyText.trim() || sending) return;
    setSending(true);
    try {
      const message = await api('/api/admin/anonymous-dm', 'POST', {
        targetUserId: selectedTicket.userId,
        text: replyText.trim(),
      });
      setMessages((current) => [...current, message as SupportMessage]);
      setReplyText('');
      await loadTickets();
      await loadThread(selectedTicket.userId);
      showToast('Ответ отправлен в чат «Техподдержка»', 'success');
    } catch (error: any) {
      showToast(getErrorMessage(error, 'Не удалось отправить ответ.'), 'error');
    } finally {
      setSending(false);
    }
  }, [loadThread, loadTickets, replyText, selectedTicket, sending]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '360px minmax(0, 1fr)',
        gap: '24px',
        minHeight: '70vh',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          padding: '18px',
          borderRadius: '18px',
          border: '1px solid var(--border, #374151)',
          background: 'rgba(15, 23, 42, 0.68)',
          minHeight: 0,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <Headset size={22} />
            <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>Техподдержка</h3>
          </div>
          <p style={{ margin: 0, color: 'var(--subtle, #9ca3af)', lineHeight: 1.6 }}>
            Тикеты и переписка пользователей в чате «Техподдержка».
          </p>
        </div>

        <div style={{ display: 'grid', gap: '10px' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--subtle, #9ca3af)' }}>Статус</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              style={{
                padding: '10px 12px',
                background: 'var(--panel-2, #111827)',
                border: '1px solid var(--border, #374151)',
                borderRadius: 10,
                color: 'var(--fg, #e5e7eb)',
              }}
            >
              <option value="all">Все статусы</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--subtle, #9ca3af)' }}>Категория</span>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              style={{
                padding: '10px 12px',
                background: 'var(--panel-2, #111827)',
                border: '1px solid var(--border, #374151)',
                borderRadius: 10,
                color: 'var(--fg, #e5e7eb)',
              }}
            >
              <option value="all">Все категории</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={loadTickets}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid rgba(148,163,184,0.24)',
              background: 'transparent',
              color: 'var(--fg, #e5e7eb)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <RefreshCw size={16} />
            Обновить
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'grid', gap: 10 }}>
          {loadingTickets ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--subtle, #9ca3af)' }}>
              <Loader size={18} className="spin" />
              Загрузка тикетов...
            </div>
          ) : tickets.length === 0 ? (
            <div style={{ color: 'var(--subtle, #9ca3af)', lineHeight: 1.6 }}>
              По текущим фильтрам тикетов нет.
            </div>
          ) : (
            tickets.map((ticket) => {
              const statusStyle = STATUS_STYLES[ticket.status || 'open'] || STATUS_STYLES.open;
              const active = ticket.id === selectedTicketId;
              return (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSelectedTicketId(ticket.id)}
                  style={{
                    textAlign: 'left',
                    padding: '14px',
                    borderRadius: 14,
                    border: active ? '1px solid rgba(89,194,255,0.35)' : '1px solid rgba(148,163,184,0.16)',
                    background: active ? 'rgba(11, 37, 63, 0.72)' : 'rgba(2, 6, 23, 0.42)',
                    color: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, lineHeight: 1.35 }}>{ticket.subject || 'Без темы'}</div>
                    <span style={{ ...statusStyle, fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '5px 9px', whiteSpace: 'nowrap' }}>
                      {ticket.statusLabel || ticket.status || 'Открыт'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--subtle, #9ca3af)', marginBottom: 8 }}>
                    {ticket.user?.username || ticket.userId} · {CATEGORY_LABELS[ticket.category || 'general'] || ticket.category || 'general'} · {PRIORITY_LABELS[ticket.priority || 'normal'] || ticket.priority || 'normal'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--fg, #e5e7eb)', opacity: 0.82, lineHeight: 1.5 }}>
                    {(ticket.body || '').slice(0, 140)}{ticket.body && ticket.body.length > 140 ? '…' : ''}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--subtle, #9ca3af)' }}>
                    Обновлён: {formatDate(ticket.updatedAt || ticket.lastReplyAt || ticket.lastMessageAt || ticket.createdAt)}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          borderRadius: '18px',
          border: '1px solid var(--border, #374151)',
          background: 'rgba(15, 23, 42, 0.68)',
          overflow: 'hidden',
        }}
      >
        {!selectedTicket ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--subtle, #9ca3af)', gap: 12 }}>
            <MessageCircle size={28} />
            Выберите тикет слева
          </div>
        ) : (
          <>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(148,163,184,0.14)', display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700 }}>{selectedTicket.subject || 'Без темы'}</h3>
                  <div style={{ color: 'var(--subtle, #9ca3af)', fontSize: 13, lineHeight: 1.6 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <UserRound size={14} />
                      {selectedTicket.user?.username || selectedTicket.userId}
                      {selectedTicket.user?.email ? ` · ${selectedTicket.user.email}` : ''}
                    </div>
                    <div>ID тикета: {selectedTicket.id} · Чат: {selectedTicket.chatId || '—'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, borderRadius: 999, padding: '6px 10px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.22)', color: '#93c5fd' }}>
                    {CATEGORY_LABELS[selectedTicket.category || 'general'] || selectedTicket.category || 'general'}
                  </span>
                  <span style={{ fontSize: 12, borderRadius: 999, padding: '6px 10px', background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.22)', color: '#e2e8f0' }}>
                    {PRIORITY_LABELS[selectedTicket.priority || 'normal'] || selectedTicket.priority || 'normal'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'center' }}>
                <select
                  value={selectedTicket.status || 'open'}
                  onChange={(event) => changeStatus(event.target.value)}
                  disabled={updatingStatus}
                  style={{
                    padding: '11px 12px',
                    background: 'var(--panel-2, #111827)',
                    border: '1px solid var(--border, #374151)',
                    borderRadius: 10,
                    color: 'var(--fg, #e5e7eb)',
                  }}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <div style={{ color: 'var(--subtle, #9ca3af)', fontSize: 12 }}>
                  {updatingStatus ? 'Сохраняю статус...' : `Создан: ${formatDate(selectedTicket.createdAt)}`}
                </div>
              </div>

              <div style={{ color: 'var(--fg, #e5e7eb)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {selectedTicket.body || 'Описание отсутствует'}
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {loadingMessages ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--subtle, #9ca3af)' }}>
                  <Loader size={18} className="spin" />
                  Загрузка переписки...
                </div>
              ) : messages.length === 0 ? (
                <div style={{ color: 'var(--subtle, #9ca3af)' }}>Чат поддержки ещё пуст.</div>
              ) : (
                messages.map((message) => {
                  const fromSupport = message.senderId === 'support';
                  return (
                    <div
                      key={message.id}
                      style={{
                        alignSelf: fromSupport ? 'flex-end' : 'flex-start',
                        maxWidth: '78%',
                        padding: '12px 14px',
                        borderRadius: 14,
                        background: fromSupport
                          ? 'linear-gradient(135deg, rgba(59,130,246,0.92), rgba(79,124,255,0.88))'
                          : 'rgba(2, 6, 23, 0.56)',
                        border: fromSupport
                          ? '1px solid rgba(96,165,250,0.32)'
                          : '1px solid rgba(148,163,184,0.16)',
                      }}
                    >
                      <div style={{ fontSize: 11, marginBottom: 6, color: fromSupport ? 'rgba(255,255,255,0.82)' : 'var(--subtle, #9ca3af)' }}>
                        {fromSupport ? 'Техподдержка' : message.sender?.username || selectedTicket.user?.username || selectedTicket.userId}
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>{message.text}</div>
                      <div style={{ fontSize: 11, marginTop: 8, color: fromSupport ? 'rgba(255,255,255,0.72)' : 'var(--subtle, #9ca3af)' }}>
                        {formatDate(message.createdAt)}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(148,163,184,0.14)', display: 'grid', gap: 10 }}>
              <textarea
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    sendReply();
                  }
                }}
                rows={4}
                placeholder="Ответ появится в чате «Техподдержка» пользователя..."
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'var(--panel-2, #111827)',
                  border: '1px solid var(--border, #374151)',
                  borderRadius: 12,
                  color: 'var(--fg, #e5e7eb)',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ color: 'var(--subtle, #9ca3af)', fontSize: 12 }}>
                  Последний ответ: {formatDate(selectedTicket.lastReplyAt || selectedTicket.lastMessageAt)}
                </div>
                <button
                  type="button"
                  onClick={sendReply}
                  disabled={!replyText.trim() || sending}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '11px 16px',
                    borderRadius: 12,
                    border: 'none',
                    background: !replyText.trim() || sending
                      ? 'rgba(100,116,139,0.45)'
                      : 'linear-gradient(135deg, #59c2ff, #4f7cff)',
                    color: !replyText.trim() || sending ? '#d1d5db' : '#04101d',
                    cursor: !replyText.trim() || sending ? 'not-allowed' : 'pointer',
                    fontWeight: 800,
                  }}
                >
                  {sending ? <Loader size={16} className="spin" /> : <Send size={16} />}
                  {sending ? 'Отправляю...' : 'Ответить'}
                </button>
              </div>
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
