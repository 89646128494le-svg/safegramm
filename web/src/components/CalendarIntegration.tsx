import React, { useEffect, useMemo, useState } from 'react';
import { api, getErrorMessage } from '../services/api';
import { showToast } from './Toast';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: number;
  endTime?: number;
  chatId?: string;
  reminderMinutes?: number;
}

interface CalendarIntegrationProps {
  chatId?: string;
  onClose: () => void;
}

const reminderOptions = [0, 5, 15, 30, 60, 120];

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(6, 10, 20, 0.78)',
  backdropFilter: 'blur(14px)',
  zIndex: 10000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px'
};

const modalStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(17,24,39,0.98) 0%, rgba(11,16,32,0.98) 100%)',
  borderRadius: '20px',
  width: '100%',
  maxWidth: '760px',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
  border: '1px solid rgba(255,255,255,0.08)',
  overflow: 'hidden'
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px',
  color: 'var(--text-primary)',
  fontSize: '14px'
};

function formatDateTime(timestamp: number) {
  return new Date(timestamp).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function toLocalDateTimeValue(timestamp: number) {
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export default function CalendarIntegration({ chatId, onClose }: CalendarIntegrationProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    reminderMinutes: 15
  });

  useEffect(() => {
    void loadEvents();
  }, [chatId]);

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = chatId ? `/api/calendar/events?chatId=${chatId}` : '/api/calendar/events';
      const data = await api(url);
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch (e: any) {
      setEvents([]);
      setError(getErrorMessage(e, 'Не удалось загрузить календарь.'));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNewEvent({ title: '', description: '', startTime: '', endTime: '', reminderMinutes: 15 });
    setShowCreateEvent(false);
  };

  const handleCreateEvent = async () => {
    const title = newEvent.title.trim();
    if (!title || !newEvent.startTime) {
      showToast('Заполните название и время начала.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api('/api/calendar/events', 'POST', {
        title,
        description: newEvent.description.trim(),
        startTime: new Date(newEvent.startTime).getTime(),
        endTime: newEvent.endTime ? new Date(newEvent.endTime).getTime() : undefined,
        chatId,
        reminderMinutes: newEvent.reminderMinutes
      });
      showToast('Событие создано.', 'success');
      resetForm();
      await loadEvents();
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось создать событие.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm('Удалить это событие?')) return;
    try {
      await api(`/api/calendar/events/${eventId}`, 'DELETE');
      showToast('Событие удалено.', 'success');
      await loadEvents();
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось удалить событие.'), 'error');
    }
  };

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.startTime - b.startTime),
    [events]
  );
  const upcomingEvents = sortedEvents.filter((event) => event.startTime >= Date.now());
  const pastEvents = [...sortedEvents.filter((event) => event.startTime < Date.now())].reverse();

  const title = chatId ? 'Календарь чата' : 'Календарь';
  const description = chatId
    ? 'Общие события и напоминания для этого чата.'
    : 'Ваши личные и доступные чатовые события.';

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                Planner
              </div>
              <h2 style={{ margin: 0, fontSize: 28, color: 'var(--text-primary)' }}>{title}</h2>
              <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>{description}</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowCreateEvent((prev) => !prev)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(124,108,255,0.4)',
                  background: 'rgba(124,108,255,0.18)',
                  color: '#f4f2ff',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                {showCreateEvent ? 'Скрыть форму' : 'Новое событие'}
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Закрыть
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginTop: 20 }}>
            {[
              ['Всего событий', String(events.length)],
              ['Предстоит', String(upcomingEvents.length)],
              ['Уже прошло', String(pastEvents.length)]
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}
              >
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {showCreateEvent && (
            <div
              style={{
                marginBottom: 20,
                padding: 18,
                borderRadius: 16,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'grid',
                gap: 12
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Новое событие</div>
              <input
                type="text"
                placeholder="Название события"
                value={newEvent.title}
                onChange={(e) => setNewEvent((prev) => ({ ...prev, title: e.target.value }))}
                style={inputStyle}
              />
              <textarea
                placeholder="Описание или заметки"
                value={newEvent.description}
                onChange={(e) => setNewEvent((prev) => ({ ...prev, description: e.target.value }))}
                style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
              />
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <label style={{ display: 'grid', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Начало</span>
                  <input
                    type="datetime-local"
                    value={newEvent.startTime}
                    onChange={(e) => setNewEvent((prev) => ({ ...prev, startTime: e.target.value }))}
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: 'grid', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Окончание</span>
                  <input
                    type="datetime-local"
                    value={newEvent.endTime}
                    onChange={(e) => setNewEvent((prev) => ({ ...prev, endTime: e.target.value }))}
                    style={inputStyle}
                  />
                </label>
              </div>
              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Напоминание</span>
                <select
                  value={newEvent.reminderMinutes}
                  onChange={(e) => setNewEvent((prev) => ({ ...prev, reminderMinutes: Number(e.target.value) }))}
                  style={inputStyle}
                >
                  {reminderOptions.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes === 0 ? 'Без напоминания' : `За ${minutes} мин`}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={resetForm}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                  }}
                >
                  Отмена
                </button>
                <button
                  onClick={handleCreateEvent}
                  disabled={submitting}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #7c6cff 0%, #5b8cff 100%)',
                    color: '#fff',
                    cursor: submitting ? 'wait' : 'pointer',
                    fontWeight: 700,
                    opacity: submitting ? 0.75 : 1
                  }}
                >
                  {submitting ? 'Сохраняю...' : 'Создать событие'}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: '14px 16px',
                borderRadius: 14,
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.22)',
                color: '#fecaca'
              }}
            >
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>Загружаю события...</div>
          ) : events.length === 0 ? (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                borderRadius: 18,
                background: 'rgba(255,255,255,0.03)',
                border: '1px dashed rgba(255,255,255,0.12)',
                color: 'var(--text-secondary)'
              }}
            >
              Пока нет событий. Создайте первое напоминание, чтобы не потерять важный созвон или дедлайн.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 24 }}>
              {upcomingEvents.length > 0 && (
                <section>
                  <h3 style={{ margin: '0 0 12px', color: 'var(--text-primary)', fontSize: 18 }}>Предстоящие события</h3>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {upcomingEvents.map((event) => (
                      <article
                        key={event.id}
                        style={{
                          padding: 18,
                          borderRadius: 16,
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.07)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 6 }}>{event.title}</div>
                            {event.description && (
                              <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 10 }}>{event.description}</div>
                            )}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
                              <span>{formatDateTime(event.startTime)}</span>
                              {event.endTime && <span>до {formatDateTime(event.endTime)}</span>}
                              <span>
                                {event.reminderMinutes ? `Напоминание за ${event.reminderMinutes} мин` : 'Без напоминания'}
                              </span>
                              {event.chatId && <span>Общее событие чата</span>}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            style={{
                              alignSelf: 'flex-start',
                              padding: '8px 12px',
                              borderRadius: 10,
                              border: '1px solid rgba(239,68,68,0.25)',
                              background: 'rgba(239,68,68,0.08)',
                              color: '#fca5a5',
                              cursor: 'pointer'
                            }}
                          >
                            Удалить
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {pastEvents.length > 0 && (
                <section>
                  <h3 style={{ margin: '0 0 12px', color: 'var(--text-primary)', fontSize: 18 }}>Прошедшие события</h3>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {pastEvents.slice(0, 10).map((event) => (
                      <article
                        key={event.id}
                        style={{
                          padding: 16,
                          borderRadius: 14,
                          background: 'rgba(255,255,255,0.025)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          opacity: 0.78
                        }}
                      >
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{event.title}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{formatDateTime(event.startTime)}</div>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
