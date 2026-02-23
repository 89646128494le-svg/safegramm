import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { showToast } from '../Toast';

export default function SecurityPolicyTab() {
  const [policy, setPolicy] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [section, setSection] = useState<'policy' | 'sessions' | 'activity' | 'alerts'>('policy');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [policyLoading, setPolicyLoading] = useState(true);

  useEffect(() => {
    if (section === 'policy') {
      setPolicyLoading(true);
      api('/api/admin/security-policy').then((p) => { setPolicy(p); setPolicyLoading(false); }).catch(() => { setPolicy(null); setPolicyLoading(false); });
    } else if (section === 'activity') {
      const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
      api(`/api/admin/suspicious-activity${q}`).then((d) => setActivity(d?.list || [])).catch(() => setActivity([]));
    } else if (section === 'alerts') {
      api('/api/admin/safety-alerts').then((d) => setAlerts(d?.alerts || [])).catch(() => setAlerts([]));
    }
  }, [section, userId]);

  const savePolicy = async () => {
    if (!policy) return;
    setLoading(true);
    try {
      await api('/api/admin/security-policy', 'PATCH', {
        require2FAForAdmins: policy.require2FAForAdmins,
        sessionMaxDays: policy.sessionMaxDays,
        passwordMinLength: policy.passwordMinLength,
        passwordRequireSpecial: policy.passwordRequireSpecial,
      });
      showToast('Сохранено', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Ошибка', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadUserSessions = async () => {
    if (!userId.trim()) return;
    setLoading(true);
    try {
      const d = await api(`/api/admin/users/${encodeURIComponent(userId)}/sessions`);
      setSessions(d?.sessions || []);
    } catch (e: any) {
      showToast(e?.message || 'Ошибка', 'error');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const terminateSession = async (sid: string) => {
    try {
      await api(`/api/admin/users/${userId}/sessions/${sid}`, 'DELETE');
      setSessions((s) => s.filter((x) => x.id !== sid));
      showToast('Сессия завершена', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Ошибка', 'error');
    }
  };

  const resolveAlert = async (id: string) => {
    try {
      await api(`/api/admin/safety-alerts/${id}/resolve`, 'POST', {});
      setAlerts((a) => a.filter((x) => x.id !== id));
      showToast('Алерт отмечен', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Ошибка', 'error');
    }
  };

  if (section === 'policy') {
    if (policyLoading) return <div className="empty" style={{ padding: 48 }}>Загрузка...</div>;
    if (!policy) return <div className="empty" style={{ padding: 48 }}>Нет данных</div>;
    return (
      <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {['policy', 'sessions', 'activity', 'alerts'].map((s) => (
            <button key={s} onClick={() => setSection(s as any)} style={{ padding: '10px 16px', background: section === s ? 'var(--accent)' : 'var(--panel-2)', color: section === s ? '#fff' : 'var(--fg)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}>{s === 'policy' ? 'Политика' : s === 'sessions' ? 'Сессии' : s === 'activity' ? 'Подозрительные действия' : 'Safety алерты'}</button>
          ))}
        </div>
        <div style={{ maxWidth: 480, display: 'grid', gap: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={policy.require2FAForAdmins || false} onChange={(e) => setPolicy({ ...policy, require2FAForAdmins: e.target.checked })} />
            Требовать 2FA для админов
          </label>
          <label>
            Срок действия сессии (дней)
            <input type="number" min={1} value={policy.sessionMaxDays || 30} onChange={(e) => setPolicy({ ...policy, sessionMaxDays: parseInt(e.target.value, 10) || 30 })} style={{ marginLeft: 8, padding: 8, width: 80 }} />
          </label>
          <label>
            Мин. длина пароля
            <input type="number" min={6} value={policy.passwordMinLength || 8} onChange={(e) => setPolicy({ ...policy, passwordMinLength: parseInt(e.target.value, 10) || 8 })} style={{ marginLeft: 8, padding: 8, width: 80 }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={policy.passwordRequireSpecial || false} onChange={(e) => setPolicy({ ...policy, passwordRequireSpecial: e.target.checked })} />
            Требовать спецсимволы в пароле
          </label>
          <button onClick={savePolicy} disabled={loading} style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Сохранить</button>
        </div>
      </div>
    );
  }

  if (section === 'sessions') {
    return (
      <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <input placeholder="User ID" value={userId} onChange={(e) => setUserId(e.target.value)} style={{ padding: 10, width: 280, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8 }} />
          <button onClick={loadUserSessions} disabled={loading}>Загрузить сессии</button>
        </div>
        {sessions.length === 0 && !loading && <div className="empty" style={{ padding: 48 }}>Введите User ID и нажмите «Загрузить сессии»</div>}
        {sessions.length > 0 && (
          <div style={{ display: 'grid', gap: 8 }}>
            {sessions.map((s) => (
              <div key={s.id} style={{ padding: 12, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><div>{s.ipAddress || '—'} · {s.userAgent?.slice(0, 50)}</div><div style={{ fontSize: 12, color: 'var(--subtle)' }}>{new Date(s.lastUsed).toLocaleString('ru-RU')}</div></div>
                <button onClick={() => terminateSession(s.id)} style={{ padding: '6px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Завершить</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (section === 'activity') {
    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <input placeholder="Фильтр по User ID" value={userId} onChange={(e) => setUserId(e.target.value)} style={{ padding: 10, width: 280, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8 }} />
        </div>
        {activity.length === 0 ? <div className="empty" style={{ padding: 48 }}>Нет записей</div> : (
          <div style={{ display: 'grid', gap: 8 }}>
            {activity.map((a) => (
              <div key={a.id} style={{ padding: 12, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <div><strong>{a.action}</strong> · User: {a.userId}</div>
                <div style={{ fontSize: 12, color: 'var(--subtle)' }}>{a.ip} · {new Date(a.createdAt).toLocaleString('ru-RU')}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (section === 'alerts') {
    return (
      <div>
        {alerts.length === 0 ? <div className="empty" style={{ padding: 48 }}>Нет алертов</div> : (
          <div style={{ display: 'grid', gap: 8 }}>
            {alerts.map((a) => (
              <div key={a.id} style={{ padding: 12, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><strong>{a.type}</strong> · {a.userId} · {a.chatId}</div>
                <button onClick={() => resolveAlert(a.id)} style={{ padding: '6px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Отметить</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['policy', 'sessions', 'activity', 'alerts'].map((s) => (
          <button key={s} onClick={() => setSection(s as any)} style={{ padding: '10px 16px', background: section === s ? 'var(--accent)' : 'var(--panel-2)', color: section === s ? '#fff' : 'var(--fg)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}>{s === 'policy' ? 'Политика' : s === 'sessions' ? 'Сессии' : s === 'activity' ? 'Подозрительные действия' : 'Safety алерты'}</button>
        ))}
      </div>
      <div className="empty" style={{ padding: 48 }}>Выберите раздел</div>
    </div>
  );
}
