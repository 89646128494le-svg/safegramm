import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { MessageCircle, Eye } from 'lucide-react';

/** Техподдержка: только чтение тикетов и ответов в чате поддержки. */
export default function SupportTab() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [fbRes] = await Promise.allSettled([
          api('/api/admin/feedback').then((r: any) => Array.isArray(r) ? r : (r?.list ?? [])),
        ]);
        const list = (fbRes as PromiseFulfilledResult<any[]>).status === 'fulfilled' ? (fbRes as any).value : [];
        setFeedback(Array.isArray(list) ? list : []);
        setTickets([]);
      } catch {
        setFeedback([]);
        setTickets([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div className="empty">Загрузка тикетов…</div>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <MessageCircle size={28} />
        Поддержка (тикеты)
      </h3>
      <p style={{ color: 'var(--subtle, #9ca3af)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Eye size={16} />
        Только чтение. Ответы на вопросы по работе SafeGram, передача сложных багов тех-админам.
      </p>

      <div style={{
        padding: '16px',
        background: 'var(--panel, rgba(31, 41, 55, 0.6))',
        borderRadius: '12px',
        border: '1px solid var(--border, #374151)',
      }}>
        <h4 style={{ marginBottom: '12px' }}>Обращения и фидбек (читай, при необходимости передай в техподдержку)</h4>
        {feedback.length === 0 ? (
          <p className="small" style={{ color: 'var(--subtle)' }}>Нет обращений.</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {feedback.map((f: any, i: number) => (
              <div
                key={f.id || i}
                style={{
                  padding: '12px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '8px',
                  borderLeft: '4px solid var(--accent, #3b82f6)',
                }}
              >
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>{f.subject || 'Без темы'}</div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{f.body || '—'}</div>
                {f.userId && <div className="small" style={{ marginTop: '8px', color: 'var(--subtle)' }}>User ID: {f.userId}</div>}
                {f.createdAt && <div className="small" style={{ color: 'var(--subtle)' }}>{new Date(f.createdAt).toLocaleString('ru-RU')}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
