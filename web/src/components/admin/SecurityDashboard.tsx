import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { showToast } from '../Toast';
import { Shield, AlertTriangle, MapPin, Lock, Activity } from 'lucide-react';

/** Карта активных сессий, подозрительные входы, блокировка IP, алерты Safety AI. */
export default function SecurityDashboard() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [blockedIps, setBlockedIps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [blockIpInput, setBlockIpInput] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const [sessRes, alertsRes, ipsRes] = await Promise.allSettled([
        api('/api/admin/security/sessions').then((r: any) => r.sessions ?? r ?? []),
        api('/api/admin/security/alerts').then((r: any) => r.alerts ?? r ?? []),
        api('/api/admin/security/blocked-ips').then((r: any) => r.ips ?? r ?? []),
      ]);
      setSessions(Array.isArray((sessRes as any).value) ? (sessRes as any).value : []);
      setAlerts(Array.isArray((alertsRes as any).value) ? (alertsRes as any).value : []);
      setBlockedIps(Array.isArray((ipsRes as any).value) ? (ipsRes as any).value : []);
    } catch (e: any) {
      setSessions([]);
      setAlerts([]);
      setBlockedIps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const handleBlockIp = async () => {
    const ip = blockIpInput.trim();
    if (!ip) return;
    try {
      await api('/api/admin/security/block-ip', 'POST', { ip });
      showToast(`IP ${ip} заблокирован`, 'success');
      setBlockIpInput('');
      load();
    } catch (e: any) {
      showToast('Ошибка: ' + (e?.message || 'не удалось заблокировать'), 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div className="empty">Загрузка Security Dashboard…</div>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Shield size={28} />
        Security Dashboard — Служба безопасности
      </h3>
      <p style={{ color: 'var(--subtle, #9ca3af)', marginBottom: '24px' }}>
        Мониторинг подозрительных входов и сессий, алерты Safety AI, блокировка IP. Работа в паре с Safety AI.
      </p>

      {/* Алерты от ИИ */}
      <section style={{ marginBottom: '24px' }}>
        <h4 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={20} color="#f59e0b" />
          Алерты Safety AI
        </h4>
        <div style={{
          padding: '16px',
          background: 'var(--panel, rgba(31, 41, 55, 0.6))',
          borderRadius: '12px',
          border: '1px solid var(--border, #374151)',
          minHeight: '80px',
        }}>
          {alerts.length === 0 ? (
            <p className="small" style={{ color: 'var(--subtle)' }}>Нет активных алертов. Эндпоинт: GET /api/admin/security/alerts</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {alerts.map((a: any, i: number) => (
                <li key={i} style={{ marginBottom: '8px' }}>
                  {a.message || a.type || JSON.stringify(a)}
                  {a.timestamp && <span className="small" style={{ marginLeft: '8px', color: 'var(--subtle)' }}>{new Date(a.timestamp).toLocaleString('ru-RU')}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Активные сессии */}
      <section style={{ marginBottom: '24px' }}>
        <h4 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={20} />
          Активные сессии
        </h4>
        <div style={{
          padding: '16px',
          background: 'var(--panel, rgba(31, 41, 55, 0.6))',
          borderRadius: '12px',
          border: '1px solid var(--border, #374151)',
          maxHeight: '300px',
          overflowY: 'auto',
        }}>
          {sessions.length === 0 ? (
            <p className="small" style={{ color: 'var(--subtle)' }}>Нет данных о сессиях. Эндпоинт: GET /api/admin/security/sessions</p>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              {sessions.map((s: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                  <span>{s.username || s.userId || s.id}</span>
                  <span className="small" style={{ color: 'var(--subtle)' }}>{s.ip || s.userAgent || ''} • {s.lastActive ? new Date(s.lastActive).toLocaleString('ru-RU') : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Блокировка IP */}
      <section>
        <h4 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Lock size={20} />
          Заблокированные IP
        </h4>
        <div style={{
          padding: '16px',
          background: 'var(--panel, rgba(31, 41, 55, 0.6))',
          borderRadius: '12px',
          border: '1px solid var(--border, #374151)',
        }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="IP-адрес для блокировки"
              value={blockIpInput}
              onChange={(e) => setBlockIpInput(e.target.value)}
              style={{
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--fg)',
                minWidth: '160px',
              }}
            />
            <button
              onClick={handleBlockIp}
              style={{
                padding: '8px 16px',
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
              }}
            >
              Заблокировать IP
            </button>
          </div>
          {blockedIps.length === 0 ? (
            <p className="small" style={{ color: 'var(--subtle)' }}>Список пуст. Эндпоинт: POST /api/admin/security/block-ip</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {blockedIps.map((ip, i) => (
                <li key={i}>{ip}</li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
