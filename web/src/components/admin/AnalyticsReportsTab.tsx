import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

export default function AnalyticsReportsTab() {
  const [section, setSection] = useState<'premium' | 'chats' | 'reports'>('premium');
  const [premium, setPremium] = useState<any>(null);
  const [chatStats, setChatStats] = useState<any>(null);
  const [reportsSummary, setReportsSummary] = useState<any>(null);

  useEffect(() => {
    if (section === 'premium') api('/api/admin/analytics/premium-dashboard').then(setPremium).catch(() => setPremium(null));
    if (section === 'chats') api('/api/admin/analytics/chat-stats').then(setChatStats).catch(() => setChatStats(null));
    if (section === 'reports') api('/api/admin/analytics/reports-summary').then(setReportsSummary).catch(() => setReportsSummary(null));
  }, [section]);

  const exportReports = () => {
    window.open(`${import.meta.env.VITE_API_URL || ''}/api/admin/analytics/reports-export`, '_blank');
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['premium', 'chats', 'reports'].map((s) => (
          <button key={s} onClick={() => setSection(s)} style={{ padding: '10px 16px', background: section === s ? 'var(--accent)' : 'var(--panel-2)', color: section === s ? '#fff' : 'var(--fg)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}>
            {s === 'premium' ? 'Премиум дашборд' : s === 'chats' ? 'Чаты' : 'Жалобы и модерация'}
          </button>
        ))}
        <a href={`${import.meta.env.VITE_API_URL || ''}/api/admin/analytics/reports-export`} target="_blank" rel="noopener noreferrer" style={{ padding: '10px 16px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, marginLeft: 'auto' }}>Экспорт отчётов CSV</a>
      </div>

      {section === 'premium' && premium && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
          <div style={{ padding: 20, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--subtle)' }}>Всего пользователей</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{premium.totalUsers}</div>
          </div>
          <div style={{ padding: 20, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--subtle)' }}>Premium</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{premium.premiumUsers}</div>
          </div>
          <div style={{ padding: 20, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--subtle)' }}>Конверсия %</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{Number(premium.conversion).toFixed(1)}%</div>
          </div>
        </div>
      )}

      {section === 'chats' && chatStats && (
        <div>
          <div style={{ marginBottom: 16 }}>Чатов с модерацией: {chatStats.chatsWithModeration}</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {(chatStats.activeChats || []).slice(0, 20).map((ch: any) => (
              <div key={ch.chatId} style={{ padding: 12, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
                {ch.name || ch.chatId} · {ch.type} · сообщений: {ch.messageCount}
              </div>
            ))}
          </div>
        </div>
      )}

      {section === 'reports' && reportsSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
          <div style={{ padding: 20, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--subtle)' }}>Обращения за период</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{reportsSummary.feedbackCount}</div>
          </div>
          <div style={{ padding: 20, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--subtle)' }}>На модерации</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{reportsSummary.pendingMessages}</div>
          </div>
          <div style={{ padding: 20, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--subtle)' }}>Одобрено</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{reportsSummary.approvedMessages}</div>
          </div>
          <div style={{ padding: 20, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--subtle)' }}>Отклонено</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{reportsSummary.rejectedMessages}</div>
          </div>
        </div>
      )}

      {((section === 'premium' && !premium) || (section === 'chats' && !chatStats) || (section === 'reports' && !reportsSummary)) && (
        <div className="empty" style={{ padding: 48 }}>Загрузка...</div>
      )}
    </div>
  );
}
