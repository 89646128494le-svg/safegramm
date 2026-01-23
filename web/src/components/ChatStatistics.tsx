import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface ChatStatisticsProps {
  chatId: string;
  onClose: () => void;
}

interface Statistics {
  totalMessages: number;
  totalMedia: number;
  totalReactions: number;
  messagesByDay: Array<{ date: string; count: number }>;
  messagesByHour: Array<{ hour: number; count: number }>;
  topParticipants: Array<{ userId: string; username: string; messageCount: number; reactionsGiven: number; reactionsReceived: number }>;
  activityTrend: Array<{ date: string; messages: number; media: number }>;
}

export default function ChatStatistics({ chatId, onClose }: ChatStatisticsProps) {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, [chatId]);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const data = await api(`/api/chats/${chatId}/statistics`);
      setStats(data);
    } catch (e: any) {
      console.error('Failed to load statistics:', e);
      // Если API не существует, вычисляем статистику на клиенте
      await calculateStatisticsLocally();
    } finally {
      setLoading(false);
    }
  };

  const calculateStatisticsLocally = async () => {
    try {
      const messagesData = await api(`/api/chats/${chatId}/messages?limit=10000`);
      const messages = messagesData.messages || [];
      
      // Подсчет статистики
      const totalMessages = messages.length;
      const totalMedia = messages.filter((m: any) => m.attachmentUrl || (m.attachments && m.attachments.length > 0)).length;
      const totalReactions = messages.reduce((sum: number, m: any) => sum + (m.reactions?.length || 0), 0);
      
      // Сообщения по дням
      const messagesByDayMap = new Map<string, number>();
      messages.forEach((m: any) => {
        const date = new Date(m.createdAt).toLocaleDateString('ru-RU');
        messagesByDayMap.set(date, (messagesByDayMap.get(date) || 0) + 1);
      });
      const messagesByDay = Array.from(messagesByDayMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // Сообщения по часам
      const messagesByHourMap = new Map<number, number>();
      messages.forEach((m: any) => {
        const hour = new Date(m.createdAt).getHours();
        messagesByHourMap.set(hour, (messagesByHourMap.get(hour) || 0) + 1);
      });
      const messagesByHour = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: messagesByHourMap.get(i) || 0
      }));
      
      // Топ участников
      const participantMap = new Map<string, { messageCount: number; reactionsGiven: number; reactionsReceived: number }>();
      messages.forEach((m: any) => {
        const senderId = m.senderId;
        if (!participantMap.has(senderId)) {
          participantMap.set(senderId, { messageCount: 0, reactionsGiven: 0, reactionsReceived: 0 });
        }
        const stats = participantMap.get(senderId)!;
        stats.messageCount++;
        stats.reactionsReceived += (m.reactions?.length || 0);
      });
      
      // Подсчет реакций, которые участник поставил
      messages.forEach((m: any) => {
        if (m.reactions) {
          m.reactions.forEach((r: any) => {
            const userId = r.userId;
            if (participantMap.has(userId)) {
              participantMap.get(userId)!.reactionsGiven++;
            }
          });
        }
      });
      
      // Загружаем имена пользователей
      const usersData = await api('/api/users');
      const usersMap = new Map((usersData.users || []).map((u: any) => [u.id, u]));
      
      const topParticipants = Array.from(participantMap.entries())
        .map(([userId, stats]) => ({
          userId,
          username: usersMap.get(userId)?.username || 'Неизвестный',
          ...stats
        }))
        .sort((a, b) => b.messageCount - a.messageCount)
        .slice(0, 10);
      
      // Тренд активности
      const activityTrendMap = new Map<string, { messages: number; media: number }>();
      messages.forEach((m: any) => {
        const date = new Date(m.createdAt).toLocaleDateString('ru-RU');
        if (!activityTrendMap.has(date)) {
          activityTrendMap.set(date, { messages: 0, media: 0 });
        }
        const trend = activityTrendMap.get(date)!;
        trend.messages++;
        if (m.attachmentUrl || (m.attachments && m.attachments.length > 0)) {
          trend.media++;
        }
      });
      
      const activityTrend = Array.from(activityTrendMap.entries())
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setStats({
        totalMessages,
        totalMedia,
        totalReactions,
        messagesByDay,
        messagesByHour,
        topParticipants,
        activityTrend
      });
    } catch (e) {
      console.error('Failed to calculate statistics:', e);
    }
  };

  const maxCount = (arr: Array<{ count: number }>) => {
    return Math.max(...arr.map(item => item.count), 1);
  };

  if (loading) {
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
        justifyContent: 'center'
      }}>
        <div style={{ color: 'white' }}>Загрузка статистики...</div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

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
        maxWidth: '900px',
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
          <h2 style={{ margin: 0, fontSize: '24px', color: 'var(--text-primary)' }}>Статистика чата</h2>
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
          {/* Общая статистика */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '16px',
            marginBottom: '32px'
          }}>
            <div style={{
              padding: '16px',
              background: 'var(--bg-secondary)',
              borderRadius: '12px',
              border: '1px solid var(--border)'
            }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                {stats.totalMessages}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Всего сообщений
              </div>
            </div>
            <div style={{
              padding: '16px',
              background: 'var(--bg-secondary)',
              borderRadius: '12px',
              border: '1px solid var(--border)'
            }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                {stats.totalMedia}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Медиафайлов
              </div>
            </div>
            <div style={{
              padding: '16px',
              background: 'var(--bg-secondary)',
              borderRadius: '12px',
              border: '1px solid var(--border)'
            }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                {stats.totalReactions}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Реакций
              </div>
            </div>
          </div>

          {/* График сообщений по часам */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '16px', color: 'var(--text-primary)' }}>
              Активность по часам
            </h3>
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '4px',
              height: '200px',
              padding: '16px',
              background: 'var(--bg-secondary)',
              borderRadius: '12px',
              border: '1px solid var(--border)'
            }}>
              {stats.messagesByHour.map((item, index) => {
                const max = maxCount(stats.messagesByHour);
                const height = (item.count / max) * 100;
                return (
                  <div
                    key={index}
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
                        minHeight: item.count > 0 ? '4px' : '0',
                        background: 'var(--accent-primary)',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s'
                      }}
                      title={`${item.hour}:00 - ${item.count} сообщений`}
                    />
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                      {item.hour}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Топ участников */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '16px', color: 'var(--text-primary)' }}>
              Топ участников
            </h3>
            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              overflow: 'hidden'
            }}>
              {stats.topParticipants.map((participant, index) => (
                <div
                  key={participant.userId}
                  style={{
                    padding: '12px 16px',
                    borderBottom: index < stats.topParticipants.length - 1 ? '1px solid var(--border)' : 'none',
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
                      background: 'var(--accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '14px'
                    }}>
                      {index + 1}
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                        {participant.username}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {participant.messageCount} сообщений
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    👍 {participant.reactionsReceived} | 👆 {participant.reactionsGiven}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* График активности по дням */}
          <div>
            <h3 style={{ fontSize: '18px', marginBottom: '16px', color: 'var(--text-primary)' }}>
              Активность по дням
            </h3>
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '8px',
              height: '200px',
              padding: '16px',
              background: 'var(--bg-secondary)',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              overflowX: 'auto'
            }}>
              {stats.messagesByDay.slice(-30).map((item, index) => {
                const max = maxCount(stats.messagesByDay);
                const height = (item.count / max) * 100;
                return (
                  <div
                    key={index}
                    style={{
                      minWidth: '30px',
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
                        minHeight: item.count > 0 ? '4px' : '0',
                        background: 'var(--accent-primary)',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s'
                      }}
                      title={`${item.date} - ${item.count} сообщений`}
                    />
                    <div style={{ fontSize: '9px', color: 'var(--text-secondary)', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                      {new Date(item.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
