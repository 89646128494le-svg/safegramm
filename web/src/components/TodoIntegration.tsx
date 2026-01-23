import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
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

export default function TodoIntegration({ chatId, onClose }: TodoIntegrationProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [newTodoText, setNewTodoText] = useState('');

  useEffect(() => {
    loadTodos();
  }, [chatId]);

  const loadTodos = async () => {
    try {
      const url = chatId ? `/api/todos?chatId=${chatId}` : '/api/todos';
      const data = await api(url);
      setTodos(data.todos || []);
    } catch (e: any) {
      // Если API не существует, используем пустой список
      setTodos([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTodo = async () => {
    if (!newTodoText.trim()) {
      showToast('Введите текст задачи', 'error');
      return;
    }

    try {
      await api('/api/todos', 'POST', {
        text: newTodoText.trim(),
        chatId: chatId,
        priority: 'medium'
      });
      showToast('Задача создана', 'success');
      setNewTodoText('');
      await loadTodos();
    } catch (e: any) {
      showToast('Ошибка создания задачи: ' + e.message, 'error');
    }
  };

  const handleToggleTodo = async (todoId: string, completed: boolean) => {
    try {
      await api(`/api/todos/${todoId}`, 'PATCH', { completed: !completed });
      await loadTodos();
    } catch (e: any) {
      showToast('Ошибка: ' + e.message, 'error');
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    if (!confirm('Удалить эту задачу?')) return;
    try {
      await api(`/api/todos/${todoId}`, 'DELETE');
      showToast('Задача удалена', 'success');
      await loadTodos();
    } catch (e: any) {
      showToast('Ошибка удаления: ' + e.message, 'error');
    }
  };

  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  const activeCount = todos.filter(t => !t.completed).length;
  const completedCount = todos.filter(t => t.completed).length;

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
        maxWidth: '600px',
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
          <h2 style={{ margin: 0, fontSize: '24px', color: 'var(--text-primary)' }}>Задачи</h2>
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
          {/* Статистика */}
          <div style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '16px',
            padding: '12px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px'
          }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                {todos.length}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Всего</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>
                {activeCount}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Активных</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                {completedCount}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Выполнено</div>
            </div>
          </div>

          {/* Фильтры */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px'
          }}>
            {(['all', 'active', 'completed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  flex: 1,
                  padding: '8px',
                  background: filter === f ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                  border: `1px solid ${filter === f ? 'var(--accent-primary)' : 'var(--border)'}`,
                  borderRadius: '8px',
                  color: filter === f ? 'white' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: filter === f ? '600' : '400'
                }}
              >
                {f === 'all' ? 'Все' : f === 'active' ? 'Активные' : 'Выполненные'}
              </button>
            ))}
          </div>

          {/* Создание задачи */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px'
          }}>
            <input
              type="text"
              placeholder="Новая задача..."
              value={newTodoText}
              onChange={e => setNewTodoText(e.target.value)}
              onKeyPress={e => {
                if (e.key === 'Enter') {
                  handleCreateTodo();
                }
              }}
              style={{
                flex: 1,
                padding: '10px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '14px'
              }}
            />
            <button
              onClick={handleCreateTodo}
              style={{
                padding: '10px 20px',
                background: 'var(--accent-primary)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Добавить
            </button>
          </div>

          {/* Список задач */}
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Загрузка...
            </div>
          ) : filteredTodos.length === 0 ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              color: 'var(--text-secondary)',
              background: 'var(--bg-secondary)',
              borderRadius: '8px'
            }}>
              {filter === 'all' ? 'Нет задач. Создайте первую задачу.' :
               filter === 'active' ? 'Нет активных задач' : 'Нет выполненных задач'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredTodos.map((todo) => (
                <div
                  key={todo.id}
                  style={{
                    padding: '12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    opacity: todo.completed ? 0.6 : 1
                  }}
                >
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => handleToggleTodo(todo.id, todo.completed)}
                    style={{
                      width: '20px',
                      height: '20px',
                      cursor: 'pointer'
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      textDecoration: todo.completed ? 'line-through' : 'none',
                      color: todo.completed ? 'var(--text-secondary)' : 'var(--text-primary)',
                      fontSize: '14px'
                    }}>
                      {todo.text}
                    </div>
                    {todo.dueDate && (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        📅 {new Date(todo.dueDate).toLocaleDateString('ru-RU')}
                      </div>
                    )}
                  </div>
                  {todo.priority && (
                    <div style={{
                      padding: '4px 8px',
                      background: todo.priority === 'high' ? 'rgba(239, 68, 68, 0.1)' :
                                   todo.priority === 'medium' ? 'rgba(245, 158, 11, 0.1)' :
                                   'rgba(16, 185, 129, 0.1)',
                      border: `1px solid ${todo.priority === 'high' ? 'rgba(239, 68, 68, 0.3)' :
                                       todo.priority === 'medium' ? 'rgba(245, 158, 11, 0.3)' :
                                       'rgba(16, 185, 129, 0.3)'}`,
                      borderRadius: '4px',
                      fontSize: '10px',
                      color: todo.priority === 'high' ? '#ef4444' :
                             todo.priority === 'medium' ? '#f59e0b' : '#10b981',
                      fontWeight: '500'
                    }}>
                      {todo.priority === 'high' ? 'Высокий' :
                       todo.priority === 'medium' ? 'Средний' : 'Низкий'}
                    </div>
                  )}
                  <button
                    onClick={() => handleDeleteTodo(todo.id)}
                    style={{
                      padding: '6px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '16px',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
