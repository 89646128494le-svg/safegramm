import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { showToast } from '../Toast';
import { useTranslation } from '../../i18n';

interface AnalyticsData {
  users: {
    total: number;
    active: number;
    new: number;
    premium: number;
    growth: number; // процент роста
  };
  messages: {
    total: number;
    today: number;
    average: number;
    peak: number;
  };
  chats: {
    total: number;
    groups: number;
    channels: number;
    dms: number;
  };
  activity: {
    hourly: Array<{ hour: number; count: number }>;
    daily: Array<{ date: string; count: number }>;
    weekly: Array<{ week: string; count: number }>;
  };
  topUsers: Array<{
    id: string;
    username: string;
    messages: number;
    reactions: number;
  }>;
  topChats: Array<{
    id: string;
    name: string;
    messages: number;
    members: number;
  }>;
}

export default function AnalyticsDashboard() {
  const { t } = useTranslation();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d');
  const [selectedMetric, setSelectedMetric] = useState<'users' | 'messages' | 'activity'>('messages');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await api(`/api/admin/analytics?range=${timeRange}`);
      if (response === null) {
        // Эндпоинт не реализован
        setData(null);
        return;
      }
      setData(response);
    } catch (e: any) {
      // Игнорируем 404 - эндпоинт еще не реализован
      if (e.status === 404 || e.errorCode === 'not_found') {
        setData(null);
        return;
      }
      showToast('Ошибка загрузки аналитики: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div className="empty">{t('common.loading')}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="empty" style={{ padding: '48px' }}>
        Нет данных
      </div>
    );
  }

  const users = data.users ?? { total: 0, active: 0, new: 0, premium: 0, growth: 0 };
  const messages = data.messages ?? { total: 0, today: 0, average: 0, peak: 0 };
  const activity = data.activity ?? { hourly: [], daily: [], weekly: [] };
  const hourly = activity.hourly ?? [];
  const daily = activity.daily ?? [];
  const topUsers = data.topUsers ?? [];
  const topChats = data.topChats ?? [];

  return (
    <div>
      {/* Заголовок и фильтры */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <h3 style={{ fontSize: '24px', fontWeight: '700' }}>📊 Аналитика и статистика</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['24h', '7d', '30d', 'all'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              style={{
                padding: '8px 16px',
                background: timeRange === range ? 'var(--accent, #3b82f6)' : 'transparent',
                color: timeRange === range ? '#fff' : 'var(--fg, #e5e7eb)',
                border: '1px solid var(--border, #374151)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: timeRange === range ? '600' : '400'
              }}
            >
              {range === '24h' ? '24 часа' : range === '7d' ? '7 дней' : range === '30d' ? '30 дней' : 'Все время'}
            </button>
          ))}
        </div>
      </div>

      {/* Основные метрики */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <MetricCard
          title="Всего пользователей"
          value={users.total}
          change={users.growth}
          icon="👥"
          color="#3b82f6"
        />
        <MetricCard
          title="Активных пользователей"
          value={users.active}
          icon="🟢"
          color="#22c55e"
        />
        <MetricCard
          title="Новых пользователей"
          value={users.new}
          icon="✨"
          color="#8b5cf6"
        />
        <MetricCard
          title="Premium пользователей"
          value={users.premium}
          icon="⭐"
          color="#f59e0b"
        />
        <MetricCard
          title="Всего сообщений"
          value={messages.total}
          icon="💬"
          color="#06b6d4"
        />
        <MetricCard
          title="Сообщений сегодня"
          value={messages.today}
          icon="📨"
          color="#10b981"
        />
        <MetricCard
          title="Среднее в день"
          value={Math.round(messages.average)}
          icon="📊"
          color="#6366f1"
        />
        <MetricCard
          title="Пик активности"
          value={messages.peak}
          icon="🔥"
          color="#ef4444"
        />
      </div>

      {/* Графики активности */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '24px',
        marginBottom: '24px'
      }}>
        <ActivityChart
          title="Активность по часам"
          data={hourly}
          type="hourly"
        />
        <ActivityChart
          title="Активность по дням"
          data={daily}
          type="daily"
        />
      </div>

      {/* Топ пользователей и чатов */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '24px'
      }}>
        <TopUsersList users={topUsers} />
        <TopChatsList chats={topChats} />
      </div>
    </div>
  );
}

function MetricCard({ title, value, change, icon, color }: {
  title: string;
  value: number;
  change?: number;
  icon: string;
  color: string;
}) {
  return (
    <div style={{
      padding: '20px',
      background: 'var(--panel, rgba(31, 41, 55, 0.6))',
      borderRadius: '12px',
      border: '1px solid var(--border, #374151)',
      transition: 'all 0.2s'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.3)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = 'none';
    }}
    >
      <div style={{
        fontSize: '32px',
        fontWeight: 'bold',
        marginBottom: '8px',
        color,
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span>{icon}</span>
        <span>{value.toLocaleString()}</span>
        {change !== undefined && (
          <span style={{
            fontSize: '14px',
            color: change >= 0 ? '#22c55e' : '#ef4444',
            marginLeft: '8px'
          }}>
            {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      <div style={{ fontSize: '14px', color: 'var(--subtle, #9ca3af)' }}>
        {title}
      </div>
    </div>
  );
}

function ActivityChart({ title, data, type }: {
  title: string;
  data: Array<{ hour?: number; date?: string; week?: string; count: number }>;
  type: 'hourly' | 'daily' | 'weekly';
}) {
  const maxValue = Math.max(...data.map(d => d.count), 1);

  return (
    <div style={{
      padding: '20px',
      background: 'var(--panel, rgba(31, 41, 55, 0.6))',
      borderRadius: '12px',
      border: '1px solid var(--border, #374151)'
    }}>
      <h4 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>{title}</h4>
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '4px',
        height: '200px',
        padding: '16px 0'
      }}>
        {data.map((item, idx) => {
          const height = (item.count / maxValue) * 100;
          const label = type === 'hourly' ? `${item.hour}:00` : type === 'daily' ? new Date(item.date!).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : item.week;
          
          return (
            <div
              key={idx}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: `${height}%`,
                  minHeight: '4px',
                  background: 'linear-gradient(180deg, #3b82f6 0%, #8b5cf6 100%)',
                  borderRadius: '4px 4px 0 0',
                  transition: 'all 0.3s',
                  cursor: 'pointer'
                }}
                title={`${label}: ${item.count}`}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              />
              <div style={{
                fontSize: '10px',
                color: 'var(--subtle, #9ca3af)',
                writingMode: type === 'hourly' ? 'horizontal-tb' : 'vertical-rl',
                textOrientation: 'mixed',
                transform: type === 'daily' ? 'rotate(180deg)' : 'none'
              }}>
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopUsersList({ users }: { users: AnalyticsData['topUsers'] }) {
  return (
    <div style={{
      padding: '20px',
      background: 'var(--panel, rgba(31, 41, 55, 0.6))',
      borderRadius: '12px',
      border: '1px solid var(--border, #374151)'
    }}>
      <h4 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>🏆 Топ пользователей</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {users.map((user, idx) => (
          <div
            key={user.id}
            style={{
              padding: '12px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--accent, #3b82f6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                color: '#fff'
              }}>
                {idx + 1}
              </div>
              <div>
                <div style={{ fontWeight: '600' }}>{user.username}</div>
                <div style={{ fontSize: '12px', color: 'var(--subtle, #9ca3af)' }}>
                  {user.messages} сообщений • {user.reactions} реакций
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopChatsList({ chats }: { chats: AnalyticsData['topChats'] }) {
  return (
    <div style={{
      padding: '20px',
      background: 'var(--panel, rgba(31, 41, 55, 0.6))',
      borderRadius: '12px',
      border: '1px solid var(--border, #374151)'
    }}>
      <h4 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>💬 Топ чатов</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {chats.map((chat, idx) => (
          <div
            key={chat.id}
            style={{
              padding: '12px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--accent, #3b82f6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                color: '#fff'
              }}>
                {idx + 1}
              </div>
              <div>
                <div style={{ fontWeight: '600' }}>{chat.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--subtle, #9ca3af)' }}>
                  {chat.messages} сообщений • {chat.members} участников
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
