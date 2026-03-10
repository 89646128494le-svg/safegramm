import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Headset, LifeBuoy, MessageCircleMore, ShieldAlert } from 'lucide-react';
import { api, getErrorMessage } from '../services/api';
import { showToast } from '../components/Toast';
import { useStore } from '../store/useStore';

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'Общий вопрос' },
  { value: 'bug', label: 'Баг / неисправность' },
  { value: 'account', label: 'Аккаунт и вход' },
  { value: 'security', label: 'Безопасность' },
  { value: 'billing', label: 'Оплата / premium' },
  { value: 'idea', label: 'Идея / улучшение' },
];

const PRIORITY_OPTIONS = [
  { value: 'normal', label: 'Обычный' },
  { value: 'high', label: 'Высокий' },
  { value: 'critical', label: 'Критический' },
  { value: 'low', label: 'Низкий' },
];

const statusStyles: Record<string, { bg: string; color: string; border: string }> = {
  open: { bg: 'rgba(59, 130, 246, 0.12)', color: '#93c5fd', border: 'rgba(59, 130, 246, 0.32)' },
  in_progress: { bg: 'rgba(168, 85, 247, 0.12)', color: '#d8b4fe', border: 'rgba(168, 85, 247, 0.32)' },
  waiting_user: { bg: 'rgba(245, 158, 11, 0.12)', color: '#fcd34d', border: 'rgba(245, 158, 11, 0.32)' },
  resolved: { bg: 'rgba(34, 197, 94, 0.12)', color: '#86efac', border: 'rgba(34, 197, 94, 0.32)' },
  closed: { bg: 'rgba(148, 163, 184, 0.14)', color: '#cbd5e1', border: 'rgba(148, 163, 184, 0.3)' },
};

function formatDate(value?: string): string {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('ru-RU');
}

export default function Feedback() {
  const navigate = useNavigate();
  const { user } = useStore();
  const isAuthenticated = !!user || (typeof localStorage !== 'undefined' && !!localStorage.getItem('token'));

  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('normal');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [tickets, setTickets] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [latestChatId, setLatestChatId] = useState('');

  const openSupportChat = useCallback(
    (chatId?: string) => {
      const target = chatId || latestChatId;
      navigate(target ? `/app/chats?chat=${encodeURIComponent(target)}` : '/app/chats');
    },
    [latestChatId, navigate]
  );

  const loadTickets = useCallback(async () => {
    if (!isAuthenticated) {
      setTickets([]);
      return;
    }
    setLoadingTickets(true);
    try {
      const response = await api('/api/feedback');
      const items = Array.isArray(response?.tickets) ? response.tickets : [];
      setTickets(items);
      if (!latestChatId) {
        const firstWithChat = items.find((item: any) => typeof item?.chatId === 'string' && item.chatId);
        if (firstWithChat?.chatId) setLatestChatId(firstWithChat.chatId);
      }
    } catch (error: any) {
      showToast(getErrorMessage(error, 'Не удалось загрузить обращения.'), 'error');
      setTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  }, [isAuthenticated, latestChatId]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const submit = useCallback(async () => {
    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();
    if (!trimmedSubject) {
      showToast('Введите тему обращения.', 'warning');
      return;
    }
    if (!trimmedBody) {
      showToast('Опишите проблему или вопрос.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api('/api/feedback', 'POST', {
        category,
        priority,
        subject: trimmedSubject,
        body: trimmedBody,
      });
      const chatId = typeof response?.chatId === 'string' ? response.chatId : '';
      setLatestChatId(chatId);
      setSubject('');
      setBody('');
      await loadTickets();
      showToast('Заявка создана. Ответы придут в чат «Анонимная поддержка».', 'success');
    } catch (error: any) {
      showToast(getErrorMessage(error, 'Не удалось отправить обращение.'), 'error');
    } finally {
      setSubmitting(false);
    }
  }, [body, category, loadTickets, priority, subject]);

  const activeTicketCount = useMemo(
    () => tickets.filter((ticket) => !['resolved', 'closed'].includes(String(ticket?.status || ''))).length,
    [tickets]
  );

  if (!isAuthenticated) {
    return (
      <div style={{ padding: '32px 20px', maxWidth: 980, margin: '0 auto' }}>
        <div
          style={{
            padding: 28,
            borderRadius: 24,
            background: 'linear-gradient(145deg, rgba(10,18,34,0.96), rgba(8,15,28,0.92))',
            border: '1px solid rgba(89,194,255,0.2)',
            boxShadow: '0 20px 55px rgba(0,0,0,0.22)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <LifeBuoy size={28} color="#6fc2ff" />
            <span style={{ color: '#7dd3fc', fontSize: 13, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 700 }}>
              SafeGram Support
            </span>
          </div>
          <h1 style={{ margin: '0 0 12px', fontSize: 34, lineHeight: 1.05 }}>Техническая поддержка SafeGram</h1>
          <p style={{ margin: '0 0 18px', color: 'var(--subtle, #9ca3af)', maxWidth: 720, lineHeight: 1.7 }}>
            Поддержка ведётся внутри SafeGram через системный чат «Анонимная поддержка». Войдите в аккаунт,
            создайте обращение и продолжайте переписку там же, где у вас обычные чаты.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link
              to="/login?redirect=%2Fsupport"
              style={{
                padding: '12px 18px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #59c2ff, #4f7cff)',
                color: '#04101d',
                textDecoration: 'none',
                fontWeight: 700,
              }}
            >
              Войти и открыть поддержку
            </Link>
            <Link
              to="/register?redirect=%2Fsupport"
              style={{
                padding: '12px 18px',
                borderRadius: 12,
                border: '1px solid rgba(148,163,184,0.28)',
                color: '#dbeafe',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Создать аккаунт
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 20px 40px', maxWidth: 1180, margin: '0 auto' }}>
      <div
        style={{
          marginBottom: 24,
          padding: 28,
          borderRadius: 26,
          background: 'radial-gradient(circle at top right, rgba(89,194,255,0.18), transparent 36%), linear-gradient(145deg, rgba(10,18,34,0.96), rgba(8,15,28,0.92))',
          border: '1px solid rgba(89,194,255,0.18)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.24)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ maxWidth: 720 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Headset size={28} color="#6fc2ff" />
              <span style={{ color: '#7dd3fc', fontSize: 13, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 700 }}>
                Support Center
              </span>
            </div>
            <h1 style={{ margin: '0 0 10px', fontSize: 34, lineHeight: 1.05 }}>Реальная техподдержка внутри SafeGram</h1>
            <p style={{ margin: 0, color: 'var(--subtle, #9ca3af)', lineHeight: 1.7 }}>
              Каждое обращение создаёт тикет и поднимает чат «Анонимная поддержка». Ответы приходят в тот же backend,
              что используют web, desktop и mobile.
            </p>
          </div>

          <div style={{ display: 'grid', gap: 12, minWidth: 220 }}>
            <div style={{ padding: 16, borderRadius: 18, background: 'rgba(8,18,36,0.7)', border: '1px solid rgba(111,194,255,0.18)' }}>
              <div style={{ color: '#7dd3fc', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Активные тикеты</div>
              <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>{activeTicketCount}</div>
            </div>
            <div style={{ padding: 16, borderRadius: 18, background: 'rgba(8,18,36,0.7)', border: '1px solid rgba(111,194,255,0.18)' }}>
              <div style={{ color: '#7dd3fc', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Канал ответов</div>
              <div style={{ marginTop: 6, fontSize: 16, fontWeight: 700 }}>Анонимная поддержка</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.05fr) minmax(320px, 0.95fr)', gap: 22 }}>
        <div
          style={{
            padding: 24,
            borderRadius: 20,
            background: 'var(--panel, rgba(31, 41, 55, 0.6))',
            border: '1px solid var(--border, #374151)',
          }}
        >
          <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>Создать обращение</h2>
          <p style={{ margin: '0 0 18px', color: 'var(--subtle, #9ca3af)', lineHeight: 1.7 }}>
            Опишите проблему один раз. Поддержка продолжит диалог уже в системном чате этого аккаунта.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Категория</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'var(--panel-2, #111827)',
                  border: '1px solid var(--border, #374151)',
                  borderRadius: 10,
                  color: 'var(--fg, #e5e7eb)',
                }}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Приоритет</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'var(--panel-2, #111827)',
                  border: '1px solid var(--border, #374151)',
                  borderRadius: 10,
                  color: 'var(--fg, #e5e7eb)',
                }}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Тема</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={120}
              placeholder="Например: Не приходит код входа"
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--panel-2, #111827)',
                border: '1px solid var(--border, #374151)',
                borderRadius: 10,
                color: 'var(--fg, #e5e7eb)',
                fontSize: 14,
              }}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Описание</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={4000}
              rows={9}
              placeholder="Что именно происходит, когда началось, на каком устройстве и как воспроизвести проблему."
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--panel-2, #111827)',
                border: '1px solid var(--border, #374151)',
                borderRadius: 10,
                color: 'var(--fg, #e5e7eb)',
                fontFamily: 'inherit',
                resize: 'vertical',
                minHeight: 180,
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !subject.trim() || !body.trim()}
              style={{
                padding: '13px 18px',
                borderRadius: 12,
                border: 'none',
                background: submitting || !subject.trim() || !body.trim()
                  ? 'rgba(100,116,139,0.55)'
                  : 'linear-gradient(135deg, #59c2ff, #4f7cff)',
                color: submitting || !subject.trim() || !body.trim() ? '#d1d5db' : '#04101d',
                fontWeight: 800,
                cursor: submitting || !subject.trim() || !body.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Отправляю...' : 'Создать тикет'}
            </button>
            <button
              type="button"
              onClick={() => openSupportChat()}
              style={{
                padding: '13px 18px',
                borderRadius: 12,
                border: '1px solid rgba(148,163,184,0.28)',
                background: 'transparent',
                color: '#dbeafe',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Открыть чат поддержки
            </button>
          </div>
        </div>

        <div
          style={{
            padding: 24,
            borderRadius: 20,
            background: 'var(--panel, rgba(31, 41, 55, 0.6))',
            border: '1px solid var(--border, #374151)',
            minHeight: 420,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 18 }}>
            <div>
              <h2 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 700 }}>Мои обращения</h2>
              <p style={{ margin: 0, color: 'var(--subtle, #9ca3af)' }}>Статусы тикетов и переход в support-chat.</p>
            </div>
            <button
              type="button"
              onClick={loadTickets}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.28)',
                background: 'transparent',
                color: '#dbeafe',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Обновить
            </button>
          </div>

          {loadingTickets ? (
            <div className="empty" style={{ padding: '48px 0' }}>Загрузка тикетов...</div>
          ) : tickets.length === 0 ? (
            <div
              style={{
                padding: 22,
                borderRadius: 18,
                background: 'rgba(8,18,36,0.56)',
                border: '1px dashed rgba(148,163,184,0.28)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <ShieldAlert size={18} color="#93c5fd" />
                <strong>Пока нет обращений</strong>
              </div>
              <div style={{ color: 'var(--subtle, #9ca3af)', lineHeight: 1.7 }}>
                После отправки первого тикета здесь появится статус и ссылка в чат поддержки.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {tickets.map((ticket) => {
                const style = statusStyles[String(ticket?.status || '')] || statusStyles.open;
                return (
                  <div
                    key={ticket.id}
                    style={{
                      padding: 16,
                      borderRadius: 18,
                      background: 'rgba(8,18,36,0.56)',
                      border: '1px solid rgba(148,163,184,0.16)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 17 }}>{ticket.subject || 'Без темы'}</div>
                        <div style={{ marginTop: 4, color: 'var(--subtle, #9ca3af)', fontSize: 13 }}>
                          {ticket.category || 'general'} · {ticket.priority || 'normal'} · {formatDate(ticket.createdAt)}
                        </div>
                      </div>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '6px 10px',
                          borderRadius: 999,
                          background: style.bg,
                          color: style.color,
                          border: `1px solid ${style.border}`,
                          fontSize: 12,
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ticket.statusLabel || ticket.status}
                      </span>
                    </div>

                    <div style={{ color: 'var(--text-secondary, #d1d5db)', lineHeight: 1.65, whiteSpace: 'pre-wrap', marginBottom: 12 }}>
                      {ticket.body}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ color: 'var(--subtle, #9ca3af)', fontSize: 13 }}>
                        Последний ответ: {formatDate(ticket.lastReplyAt)}
                      </div>
                      <button
                        type="button"
                        onClick={() => openSupportChat(ticket.chatId)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '10px 14px',
                          borderRadius: 10,
                          border: '1px solid rgba(111,194,255,0.24)',
                          background: 'rgba(89,194,255,0.08)',
                          color: '#bae6fd',
                          cursor: 'pointer',
                          fontWeight: 700,
                        }}
                      >
                        <MessageCircleMore size={16} />
                        Открыть чат
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: 22,
          padding: 18,
          borderRadius: 18,
          background: 'rgba(59,130,246,0.08)',
          border: '1px solid rgba(59,130,246,0.22)',
          color: '#bfdbfe',
          lineHeight: 1.7,
        }}
      >
        <strong>Как это работает:</strong> создаёте тикет на сайте, support получает его в админке, отвечает через
        анонимный системный чат, а вы продолжаете переписку уже внутри SafeGram на всех клиентах.
      </div>
    </div>
  );
}
