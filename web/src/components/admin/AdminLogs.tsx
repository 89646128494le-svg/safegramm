import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { showToast } from '../Toast';
import { useTranslation } from '../../i18n';

interface AdminLog {
  id: string;
  adminId: string;
  adminUsername: string;
  action: string;
  targetType: 'user' | 'chat' | 'message' | 'system';
  targetId: string;
  targetName?: string;
  details: string;
  timestamp: number;
  ip?: string;
}

export default function AdminLogs() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: 'all',
    targetType: 'all',
    adminId: '',
    dateFrom: '',
    dateTo: ''
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadLogs();
  }, [page, filters]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== 'all' && v !== ''))
      });
      const response = await api(`/api/admin/logs?${params}`);
      setLogs(response.logs || []);
      setTotalPages(response.totalPages || 1);
    } catch (e: any) {
      showToast('Ошибка загрузки логов: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes('ban')) return '🚫';
    if (action.includes('mute')) return '🔇';
    if (action.includes('delete')) return '🗑️';
    if (action.includes('promote')) return '⬆️';
    if (action.includes('demote')) return '⬇️';
    if (action.includes('create')) return '➕';
    if (action.includes('update')) return '✏️';
    return '📝';
  };

  const getActionColor = (action: string) => {
    if (action.includes('ban') || action.includes('delete')) return '#ef4444';
    if (action.includes('mute')) return '#f59e0b';
    if (action.includes('promote')) return '#22c55e';
    if (action.includes('demote')) return '#ef4444';
    return '#3b82f6';
  };

  return (
    <div>
      <h3 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>
        📜 Логи действий администраторов
      </h3>

      {/* Фильтры */}
      <div style={{
        padding: '20px',
        background: 'var(--panel, rgba(31, 41, 55, 0.6))',
        borderRadius: '12px',
        border: '1px solid var(--border, #374151)',
        marginBottom: '24px'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px'
        }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
              Действие:
            </label>
            <select
              value={filters.action}
              onChange={e => setFilters({ ...filters, action: e.target.value })}
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#e9ecf5'
              }}
            >
              <option value="all">Все действия</option>
              <option value="ban">Баны</option>
              <option value="mute">Муты</option>
              <option value="delete">Удаления</option>
              <option value="promote">Повышения</option>
              <option value="demote">Понижения</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
              Тип цели:
            </label>
            <select
              value={filters.targetType}
              onChange={e => setFilters({ ...filters, targetType: e.target.value })}
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#e9ecf5'
              }}
            >
              <option value="all">Все типы</option>
              <option value="user">Пользователь</option>
              <option value="chat">Чат</option>
              <option value="message">Сообщение</option>
              <option value="system">Система</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
              ID администратора:
            </label>
            <input
              type="text"
              value={filters.adminId}
              onChange={e => setFilters({ ...filters, adminId: e.target.value })}
              placeholder="Фильтр по ID..."
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#e9ecf5'
              }}
            />
          </div>
        </div>
      </div>

      {/* Логи */}
      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <div className="empty">{t('common.loading')}</div>
        </div>
      ) : logs.length === 0 ? (
        <div className="empty" style={{ padding: '48px' }}>
          Нет логов
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
            {logs.map(log => (
              <div
                key={log.id}
                style={{
                  padding: '16px',
                  background: 'var(--panel, rgba(31, 41, 55, 0.6))',
                  border: '1px solid var(--border, #374151)',
                  borderRadius: '12px',
                  borderLeft: `4px solid ${getActionColor(log.action)}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>{getActionIcon(log.action)}</span>
                    <div>
                      <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                        {log.action} • {log.adminUsername}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--subtle, #9ca3af)' }}>
                        {log.targetType}: {log.targetName || log.targetId}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--subtle, #9ca3af)', textAlign: 'right' }}>
                    {new Date(log.timestamp).toLocaleString('ru-RU')}
                  </div>
                </div>
                <div style={{
                  padding: '8px 12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  marginTop: '8px'
                }}>
                  {log.details}
                </div>
                {log.ip && (
                  <div style={{ fontSize: '12px', color: 'var(--subtle, #9ca3af)', marginTop: '8px' }}>
                    IP: {log.ip}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Пагинация */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px'
            }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  padding: '8px 16px',
                  background: page === 1 ? '#6b7280' : 'var(--accent, #3b82f6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  opacity: page === 1 ? 0.6 : 1
                }}
              >
                ← Назад
              </button>
              <span style={{ padding: '8px 16px' }}>
                Страница {page} из {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  padding: '8px 16px',
                  background: page === totalPages ? '#6b7280' : 'var(--accent, #3b82f6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  opacity: page === totalPages ? 0.6 : 1
                }}
              >
                Вперёд →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
