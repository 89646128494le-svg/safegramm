import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { showToast } from '../Toast';
import { useTranslation } from '../../i18n';

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  database: {
    status: 'connected' | 'disconnected';
    latency: number;
  };
  websocket: {
    connections: number;
    status: 'active' | 'inactive';
  };
  errors: Array<{
    type: string;
    message: string;
    timestamp: number;
    count: number;
  }>;
}

export default function SystemMonitor() {
  const { t } = useTranslation();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadHealth();
    if (autoRefresh) {
      const interval = setInterval(loadHealth, 5000); // Обновление каждые 5 секунд
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadHealth = async () => {
    try {
      const response = await api('/api/admin/system/health');
      setHealth(response);
    } catch (e: any) {
      showToast('Ошибка загрузки: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
      case 'active':
        return '#22c55e';
      case 'warning':
        return '#f59e0b';
      case 'critical':
      case 'disconnected':
      case 'inactive':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}д ${hours}ч ${minutes}м`;
  };

  if (loading && !health) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div className="empty">{t('common.loading')}</div>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="empty" style={{ padding: '48px' }}>
        Нет данных
      </div>
    );
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h3 style={{ fontSize: '24px', fontWeight: '700' }}>
          🖥️ Мониторинг системы
        </h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={e => setAutoRefresh(e.target.checked)}
          />
          <span>Автообновление</span>
        </label>
      </div>

      {/* Общий статус */}
      <div style={{
        padding: '20px',
        background: `rgba(${health.status === 'healthy' ? '34, 197, 94' : health.status === 'warning' ? '245, 158, 11' : '239, 68, 68'}, 0.1)`,
        border: `1px solid rgba(${health.status === 'healthy' ? '34, 197, 94' : health.status === 'warning' ? '245, 158, 11' : '239, 68, 68'}, 0.3)`,
        borderRadius: '12px',
        marginBottom: '24px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>
              Статус системы: <span style={{ color: getStatusColor(health.status) }}>
                {health.status === 'healthy' ? '✅ Здорова' : health.status === 'warning' ? '⚠️ Предупреждение' : '🔴 Критично'}
              </span>
            </div>
            <div style={{ fontSize: '14px', color: 'var(--subtle, #9ca3af)' }}>
              Uptime: {formatUptime(health.uptime)}
            </div>
          </div>
          <button
            onClick={loadHealth}
            style={{
              padding: '10px 20px',
              background: 'var(--accent, #3b82f6)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            🔄 Обновить
          </button>
        </div>
      </div>

      {/* Метрики */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <MetricCard
          title="Память"
          value={`${(health.memory.used / 1024 / 1024).toFixed(2)} MB`}
          subtitle={`из ${(health.memory.total / 1024 / 1024).toFixed(2)} MB`}
          percentage={health.memory.percentage}
          color={health.memory.percentage > 90 ? '#ef4444' : health.memory.percentage > 70 ? '#f59e0b' : '#22c55e'}
        />
        <MetricCard
          title="CPU"
          value={`${health.cpu.usage.toFixed(1)}%`}
          percentage={health.cpu.usage}
          color={health.cpu.usage > 90 ? '#ef4444' : health.cpu.usage > 70 ? '#f59e0b' : '#22c55e'}
        />
        <MetricCard
          title="База данных"
          value={health.database.status === 'connected' ? 'Подключена' : 'Отключена'}
          subtitle={`Задержка: ${health.database.latency}ms`}
          color={getStatusColor(health.database.status)}
        />
        <MetricCard
          title="WebSocket"
          value={`${health.websocket.connections} соединений`}
          subtitle={health.websocket.status === 'active' ? 'Активен' : 'Неактивен'}
          color={getStatusColor(health.websocket.status)}
        />
      </div>

      {/* Ошибки */}
      {health.errors.length > 0 && (
        <div style={{
          padding: '20px',
          background: 'var(--panel, rgba(31, 41, 55, 0.6))',
          borderRadius: '12px',
          border: '1px solid var(--border, #374151)'
        }}>
          <h4 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600', color: '#ef4444' }}>
            ⚠️ Последние ошибки
          </h4>
          <div style={{ display: 'grid', gap: '8px' }}>
            {health.errors.map((error, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.3)'
                }}
              >
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                  {error.type} ({error.count} раз)
                </div>
                <div style={{ fontSize: '14px', color: 'var(--subtle, #9ca3af)' }}>
                  {error.message}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--subtle, #9ca3af)', marginTop: '4px' }}>
                  {new Date(error.timestamp).toLocaleString('ru-RU')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, subtitle, percentage, color }: {
  title: string;
  value: string;
  subtitle?: string;
  percentage?: number;
  color: string;
}) {
  return (
    <div style={{
      padding: '20px',
      background: 'var(--panel, rgba(31, 41, 55, 0.6))',
      borderRadius: '12px',
      border: '1px solid var(--border, #374151)'
    }}>
      <div style={{ fontSize: '14px', color: 'var(--subtle, #9ca3af)', marginBottom: '8px' }}>
        {title}
      </div>
      <div style={{ fontSize: '24px', fontWeight: 'bold', color, marginBottom: '4px' }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: '12px', color: 'var(--subtle, #9ca3af)' }}>
          {subtitle}
        </div>
      )}
      {percentage !== undefined && (
        <div style={{ marginTop: '12px' }}>
          <div style={{
            width: '100%',
            height: '4px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${percentage}%`,
              height: '100%',
              background: color,
              transition: 'width 0.3s'
            }} />
          </div>
        </div>
      )}
    </div>
  );
}
