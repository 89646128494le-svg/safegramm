import React, { useEffect, useMemo, useState } from 'react';
import { api, getErrorMessage } from '../services/api';
import { showToast } from './Toast';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  chatId?: string;
  assignedTo?: string;
  dueDate?: number;
  priority?: 'low' | 'medium' | 'high';
  createdAt: number;
}

interface TodoIntegrationProps {
  chatId?: string;
  onClose: () => void;
}

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
  maxWidth: '720px',
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

const priorityLabel: Record<NonNullable<Todo['priority']>, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий'
};

const priorityAccent: Record<NonNullable<Todo['priority']>, string> = {
  low: '#34d399',
  medium: '#fbbf24',
  high: '#f87171'
};

export default function TodoIntegration({ chatId, onClose }: TodoIntegrationProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [newTodoText, setNewTodoText] = useState('');
  const [newTodoPriority, setNewTodoPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newTodoDueDate, setNewTodoDueDate] = useState('');

  useEffect(() => {
    void loadTodos();
  }, [chatId]);

  const loadTodos = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = chatId ? `/api/todos?chatId=${chatId}` : '/api/todos';
      const data = await api(url);
      setTodos(Array.isArray(data.todos) ? data.todos : []);
    } catch (e: any) {
      setTodos([]);
      setError(getErrorMessage(e, 'Не удалось загрузить список задач.'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTodo = async () => {
    const text = newTodoText.trim();
    if (!text) {
      showToast('Введите текст задачи.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api('/api/todos', 'POST', {
        text,
        chatId,
        priority: newTodoPriority,
        dueDate: newTodoDueDate ? new Date(newTodoDueDate).getTime() : undefined
      });
      showToast('Задача создана.', 'success');
      setNewTodoText('');
      setNewTodoPriority('medium');
      setNewTodoDueDate('');
      await loadTodos();
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось создать задачу.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleTodo = async (todo: Todo) => {
    try {
      await api(`/api/todos/${todo.id}`, 'PATCH', { completed: !todo.completed });
      await loadTodos();
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось обновить задачу.'), 'error');
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    if (!window.confirm('Удалить эту задачу?')) return;
    try {
      await api(`/api/todos/${todoId}`, 'DELETE');
      showToast('Задача удалена.', 'success');
      await loadTodos();
    } catch (e: any) {
      showToast(getErrorMessage(e, 'Не удалось удалить задачу.'), 'error');
    }
  };

  const filteredTodos = useMemo(() => {
    return todos.filter((todo) => {
      if (filter === 'active') return !todo.completed;
      if (filter === 'completed') return todo.completed;
      return true;
    });
  }, [todos, filter]);

  const activeCount = todos.filter((todo) => !todo.completed).length;
  const completedCount = todos.filter((todo) => todo.completed).length;
  const overdueCount = todos.filter((todo) => !todo.completed && todo.dueDate && todo.dueDate < Date.now()).length;

  const title = chatId ? 'Задачи чата' : 'Мои задачи';
  const description = chatId
    ? 'Общий список задач для участников этого чата.'
    : 'Личные задачи и доступные списки из ваших чатов.';

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                Todo board
              </div>
              <h2 style={{ margin: 0, fontSize: 28, color: 'var(--text-primary)' }}>{title}</h2>
              <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>{description}</p>
            </div>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginTop: 20 }}>
            {[
              ['Всего', String(todos.length)],
              ['Активные', String(activeCount)],
              ['Просроченные', String(overdueCount)]
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
          <div
            style={{
              display: 'grid',
              gap: 12,
              padding: 18,
              borderRadius: 16,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              marginBottom: 18
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Новая задача</div>
            <input
              type="text"
              placeholder="Что нужно сделать?"
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleCreateTodo();
                }
              }}
              style={inputStyle}
            />
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Приоритет</span>
                <select
                  value={newTodoPriority}
                  onChange={(e) => setNewTodoPriority(e.target.value as 'low' | 'medium' | 'high')}
                  style={inputStyle}
                >
                  <option value="low">Низкий</option>
                  <option value="medium">Средний</option>
                  <option value="high">Высокий</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Дедлайн</span>
                <input
                  type="datetime-local"
                  value={newTodoDueDate}
                  onChange={(e) => setNewTodoDueDate(e.target.value)}
                  style={inputStyle}
                />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCreateTodo}
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
                {submitting ? 'Сохраняю...' : 'Добавить задачу'}
              </button>
            </div>
          </div>

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

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {([
              ['all', `Все (${todos.length})`],
              ['active', `Активные (${activeCount})`],
              ['completed', `Выполненные (${completedCount})`]
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 999,
                  border: `1px solid ${filter === value ? 'rgba(124,108,255,0.45)' : 'rgba(255,255,255,0.08)'}`,
                  background: filter === value ? 'rgba(124,108,255,0.18)' : 'rgba(255,255,255,0.04)',
                  color: filter === value ? '#f4f2ff' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>Загружаю задачи...</div>
          ) : filteredTodos.length === 0 ? (
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
              {filter === 'all'
                ? 'Список пока пуст. Добавьте первую задачу.'
                : filter === 'active'
                  ? 'Активных задач сейчас нет.'
                  : 'Завершённых задач пока нет.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {filteredTodos.map((todo) => {
                const priority = todo.priority ?? 'medium';
                const isOverdue = !todo.completed && !!todo.dueDate && todo.dueDate < Date.now();
                return (
                  <article
                    key={todo.id}
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      display: 'flex',
                      gap: 14,
                      alignItems: 'flex-start',
                      opacity: todo.completed ? 0.72 : 1
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => handleToggleTodo(todo)}
                      style={{ width: 18, height: 18, marginTop: 3, cursor: 'pointer' }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          color: 'var(--text-primary)',
                          fontSize: 15,
                          fontWeight: 600,
                          textDecoration: todo.completed ? 'line-through' : 'none',
                          marginBottom: 8
                        }}
                      >
                        {todo.text}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: 999,
                            background: `${priorityAccent[priority]}18`,
                            border: `1px solid ${priorityAccent[priority]}33`,
                            color: priorityAccent[priority],
                            fontWeight: 700
                          }}
                        >
                          {priorityLabel[priority]}
                        </span>
                        {todo.dueDate && (
                          <span style={{ color: isOverdue ? '#fca5a5' : 'var(--text-secondary)' }}>
                            {isOverdue ? 'Просрочено: ' : 'Дедлайн: '}
                            {new Date(todo.dueDate).toLocaleString('ru-RU')}
                          </span>
                        )}
                        {todo.chatId && <span>Общая задача чата</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteTodo(todo.id)}
                      style={{
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
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
