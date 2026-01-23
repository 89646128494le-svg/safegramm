import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { showToast } from './Toast';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: number;
  endTime?: number;
  chatId?: string;
  participants?: string[];
  reminderMinutes?: number;
}

interface CalendarIntegrationProps {
  chatId?: string;
  onClose: () => void;
}

export default function CalendarIntegration({ chatId, onClose }: CalendarIntegrationProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    reminderMinutes: 15
  });

  useEffect(() => {
    loadEvents();
  }, [chatId]);

  const loadEvents = async () => {
    try {
      const url = chatId ? `/api/calendar/events?chatId=${chatId}` : '/api/calendar/events';
      const data = await api(url);
      setEvents(data.events || []);
    } catch (e: any) {
      // Если API не существует, используем пустой список
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.startTime) {
      showToast('Заполните название и время начала', 'error');
      return;
    }

    try {
      await api('/api/calendar/events', 'POST', {
        title: newEvent.title,
        description: newEvent.description,
        startTime: new Date(newEvent.startTime).getTime(),
        endTime: newEvent.endTime ? new Date(newEvent.endTime).getTime() : undefined,
        chatId: chatId,
        reminderMinutes: newEvent.reminderMinutes
      });
      showToast('Событие создано', 'success');
      setShowCreateEvent(false);
      setNewEvent({ title: '', description: '', startTime: '', endTime: '', reminderMinutes: 15 });
      await loadEvents();
    } catch (e: any) {
      showToast('Ошибка создания события: ' + e.message, 'error');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Удалить это событие?')) return;
    try {
      await api(`/api/calendar/events/${eventId}`, 'DELETE');
      showToast('Событие удалено', 'success');
      await loadEvents();
    } catch (e: any) {
      showToast('Ошибка удаления: ' + e.message, 'error');
    }
  };

  const formatDateTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('ru-RU');
  };

  const upcomingEvents = events.filter(e => e.startTime > Date.now()).sort((a, b) => a.startTime - b.startTime);
  const pastEvents = events.filter(e => e.startTime <= Date.now()).sort((a, b) => b.startTime - a.startTime);

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
          <h2 style={{ margin: 0, fontSize: '24px', color: 'var(--text-primary)' }}>Календарь</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowCreateEvent(true)}
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
              + Событие
            </button>
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
              {/* Предстоящие события */}
              {upcomingEvents.length > 0 && (
                <div style={{ marginBottom: '32px' }}>
                  <h3 style={{ fontSize: '18px', marginBottom: '16px', color: 'var(--text-primary)' }}>
                    Предстоящие события
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {upcomingEvents.map((event) => (
                      <div
                        key={event.id}
                        style={{
                          padding: '16px',
                          background: 'var(--bg-secondary)',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          position: 'relative'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', fontSize: '16px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                              {event.title}
                            </div>
                            {event.description && (
                              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                {event.description}
                              </div>
                            )}
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              📅 {formatDateTime(event.startTime)}
                              {event.endTime && ` - ${formatDateTime(event.endTime)}`}
                            </div>
                            {event.reminderMinutes && (
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                ⏰ Напоминание за {event.reminderMinutes} минут
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
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
                </div>
              )}

              {/* Прошедшие события */}
              {pastEvents.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '18px', marginBottom: '16px', color: 'var(--text-primary)' }}>
                    Прошедшие события
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {pastEvents.slice(0, 10).map((event) => (
                      <div
                        key={event.id}
                        style={{
                          padding: '16px',
                          background: 'var(--bg-secondary)',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          opacity: 0.7
                        }}
                      >
                        <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                          {event.title}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          📅 {formatDateTime(event.startTime)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {events.length === 0 && (
                <div style={{
                  padding: '40px',
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px'
                }}>
                  Нет событий. Создайте первое событие.
                </div>
              )}

              {/* Форма создания события */}
              {showCreateEvent && (
                <div style={{
                  marginTop: '24px',
                  padding: '16px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)'
                }}>
                  <h3 style={{ fontSize: '16px', marginBottom: '12px', color: 'var(--text-primary)' }}>
                    Создать событие
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input
                      type="text"
                      placeholder="Название события"
                      value={newEvent.title}
                      onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                      style={{
                        padding: '10px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)'
                      }}
                    />
                    <textarea
                      placeholder="Описание (необязательно)"
                      value={newEvent.description}
                      onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
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
                    <input
                      type="datetime-local"
                      value={newEvent.startTime}
                      onChange={e => setNewEvent({ ...newEvent, startTime: e.target.value })}
                      style={{
                        padding: '10px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)'
                      }}
                    />
                    <input
                      type="datetime-local"
                      placeholder="Время окончания (необязательно)"
                      value={newEvent.endTime}
                      onChange={e => setNewEvent({ ...newEvent, endTime: e.target.value })}
                      style={{
                        padding: '10px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={handleCreateEvent}
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
                          setShowCreateEvent(false);
                          setNewEvent({ title: '', description: '', startTime: '', endTime: '', reminderMinutes: 15 });
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
