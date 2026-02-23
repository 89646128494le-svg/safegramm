import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { showToast } from '../Toast';

export default function SystemIntegrationsTab() {
  const [section, setSection] = useState<'bots' | 'limits' | 'flags'>('bots');
  const [bots, setBots] = useState<any[]>([]);
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<any[]>([]);
  const [newFlagKey, setNewFlagKey] = useState('');

  useEffect(() => {
    if (section === 'bots') api('/api/admin/bots').then((d) => setBots(d?.bots || [])).catch(() => setBots([]));
    if (section === 'limits') api('/api/admin/limits').then((d) => setLimits(d?.limits || {})).catch(() => setLimits({}));
    if (section === 'flags') api('/api/admin/feature-flags').then((d) => setFlags(d?.flags || [])).catch(() => setFlags([]));
  }, [section]);

  const toggleBot = async (id: string, enable: boolean) => {
    try {
      await api(`/api/admin/bots/${id}/${enable ? 'enable' : 'disable'}`, 'POST', {});
      setBots((b) => b.map((x) => (x.id === id ? { ...x, isActive: enable } : x)));
      showToast(enable ? 'Включён' : 'Выключен', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Ошибка', 'error');
    }
  };

  const saveLimits = async () => {
    try {
      await api('/api/admin/limits', 'PATCH', limits);
      showToast('Сохранено', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Ошибка', 'error');
    }
  };

  const addFlag = async () => {
    if (!newFlagKey.trim()) return;
    try {
      await api('/api/admin/feature-flags', 'POST', { key: newFlagKey.trim(), enabled: true, percent: 100 });
      setNewFlagKey('');
      const d = await api('/api/admin/feature-flags');
      setFlags(d?.flags || []);
      showToast('Добавлено', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Ошибка', 'error');
    }
  };

  const toggleFlag = async (id: string, enabled: boolean) => {
    try {
      await api(`/api/admin/feature-flags/${id}`, 'PATCH', { enabled });
      setFlags((f) => f.map((x) => (x.id === id ? { ...x, enabled } : x)));
    } catch (e: any) {
      showToast(e?.message || 'Ошибка', 'error');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['bots', 'limits', 'flags'].map((s) => (
          <button key={s} onClick={() => setSection(s)} style={{ padding: '10px 16px', background: section === s ? 'var(--accent)' : 'var(--panel-2)', color: section === s ? '#fff' : 'var(--fg)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}>
            {s === 'bots' ? 'Боты платформы' : s === 'limits' ? 'Лимиты' : 'Feature flags'}
          </button>
        ))}
      </div>

      {section === 'bots' && (
        <div>
          {bots.length === 0 ? <div className="empty" style={{ padding: 48 }}>Нет ботов</div> : (
            <div style={{ display: 'grid', gap: 8 }}>
              {bots.map((b) => (
                <div key={b.id} style={{ padding: 12, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>@{b.username} · {b.name} · Владелец: {b.userId}</div>
                  <button onClick={() => toggleBot(b.id, !b.isActive)} style={{ padding: '6px 12px', background: b.isActive ? '#ef4444' : '#22c55e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>{b.isActive ? 'Выключить' : 'Включить'}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'limits' && (
        <div>
          <div style={{ display: 'grid', gap: 12, maxWidth: 400 }}>
            {Object.entries(limits).map(([k, v]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 180 }}>{k}</span>
                <input value={v} onChange={(e) => setLimits((l) => ({ ...l, [k]: e.target.value }))} style={{ padding: 8, flex: 1, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8 }} />
              </label>
            ))}
          </div>
          <button onClick={saveLimits} style={{ marginTop: 16, padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Сохранить лимиты</button>
        </div>
      )}

      {section === 'flags' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input placeholder="Ключ флага" value={newFlagKey} onChange={(e) => setNewFlagKey(e.target.value)} style={{ padding: 10, width: 200, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8 }} />
            <button onClick={addFlag} style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Добавить</button>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {flags.map((f) => (
              <div key={f.id} style={{ padding: 10, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><strong>{f.key}</strong> · {f.enabled ? 'вкл' : 'выкл'} · {f.percent}%</span>
                <label><input type="checkbox" checked={f.enabled} onChange={(e) => toggleFlag(f.id, e.target.checked)} /> Вкл</label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
