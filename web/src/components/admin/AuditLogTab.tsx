import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { showToast } from '../Toast';

export default function AuditLogTab() {
  const [log, setLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [adminId, setAdminId] = useState('');

  useEffect(() => {
    load();
  }, [action, adminId]);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (action) params.set('action', action);
      if (adminId) params.set('adminId', adminId);
      params.set('limit', '200');
      const data = await api(`/api/admin/audit-log?${params}`);
      setLog(data?.log || []);
    } catch (e: any) {
      showToast(e?.message || 'Ошибка загрузки', 'error');
      setLog([]);
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    window.open(`${import.meta.env.VITE_API_URL || ''}/api/admin/analytics/audit-export?limit=1000`, '_blank');
  };

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Фильтр по действию"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          style={{ padding: '8px 12px', width: 180, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8 }}
        />
        <input
          placeholder="Admin ID"
          value={adminId}
          onChange={(e) => setAdminId(e.target.value)}
          style={{ padding: '8px 12px', width: 180, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8 }}
        />
        <button onClick={load} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          Обновить
        </button>
        <button onClick={exportCsv} style={{ padding: '8px 16px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}>
          Экспорт CSV
        </button>
      </div>
      {loading ? (
        <div className="empty" style={{ padding: 48 }}>Загрузка...</div>
      ) : log.length === 0 ? (
        <div className="empty" style={{ padding: 48 }}>Нет записей</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: 10 }}>Время</th>
                <th style={{ textAlign: 'left', padding: 10 }}>Админ</th>
                <th style={{ textAlign: 'left', padding: 10 }}>Действие</th>
                <th style={{ textAlign: 'left', padding: 10 }}>Цель</th>
                <th style={{ textAlign: 'left', padding: 10 }}>Детали</th>
                <th style={{ textAlign: 'left', padding: 10 }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {log.map((e) => (
                <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 10, fontSize: 13 }}>{new Date(e.createdAt).toLocaleString('ru-RU')}</td>
                  <td style={{ padding: 10, fontFamily: 'monospace', fontSize: 12 }}>{e.adminId}</td>
                  <td style={{ padding: 10 }}>{e.action}</td>
                  <td style={{ padding: 10, fontFamily: 'monospace', fontSize: 12 }}>{e.targetId}</td>
                  <td style={{ padding: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.details || '—'}</td>
                  <td style={{ padding: 10, fontSize: 12 }}>{e.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
