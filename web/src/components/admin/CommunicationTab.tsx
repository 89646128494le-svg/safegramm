import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { showToast } from '../Toast';

export default function CommunicationTab() {
  const [section, setSection] = useState<'templates' | 'domain' | 'invites'>('templates');
  const [templates, setTemplates] = useState<any[]>([]);
  const [domainList, setDomainList] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [domainAllow, setDomainAllow] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviterName, setInviterName] = useState('');
  const [questionnaire, setQuestionnaire] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);

  useEffect(() => {
    if (section === 'templates') api('/api/admin/email-templates').then((d) => setTemplates(d?.templates || [])).catch(() => setTemplates([]));
    if (section === 'domain') api('/api/admin/domain-list').then((d) => setDomainList(d?.list || [])).catch(() => setDomainList([]));
    if (section === 'invites') api('/api/admin/invite-links').then((d) => setInvites(d?.list || [])).catch(() => setInvites([]));
  }, [section]);

  const addDomain = async () => {
    if (!newDomain.trim()) return;
    try {
      await api('/api/admin/domain-list', 'POST', { value: newDomain.trim(), isDomain: true, allow: domainAllow, forInvite: true, forReg: true });
      setNewDomain('');
      const d = await api('/api/admin/domain-list');
      setDomainList(d?.list || []);
      showToast('Добавлено', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Ошибка', 'error');
    }
  };

  const deleteDomain = async (id: string) => {
    try {
      await api(`/api/admin/domain-list/${id}`, 'DELETE');
      setDomainList((l) => l.filter((x) => x.id !== id));
    } catch (e: any) {
      showToast(e?.message || 'Ошибка', 'error');
    }
  };

  const createInvite = async () => {
    try {
      setCreatingInvite(true);
      const d = await api('/api/admin/invite-links', 'POST', {
        maxUses: 0,
        inviterName: inviterName.trim(),
        questionnaire: questionnaire.trim(),
      });
      showToast('Ссылка создана', 'success');
      setShowInviteForm(false);
      setInviterName('');
      setQuestionnaire('');
      const list = await api('/api/admin/invite-links');
      setInvites(list?.list || []);
    } catch (e: any) {
      showToast(e?.message || 'Ошибка', 'error');
    } finally {
      setCreatingInvite(false);
    }
  };

  const revokeInvite = async (id: string) => {
    try {
      await api(`/api/admin/invite-links/${id}`, 'PATCH', { active: false });
      setInvites((l) => l.map((x) => (x.id === id ? { ...x, active: false } : x)));
      showToast('Отозвано', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Ошибка', 'error');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['templates', 'domain', 'invites'].map((s) => (
          <button key={s} onClick={() => setSection(s)} style={{ padding: '10px 16px', background: section === s ? 'var(--accent)' : 'var(--panel-2)', color: section === s ? '#fff' : 'var(--fg)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}>
            {s === 'templates' ? 'Шаблоны рассылок' : s === 'domain' ? 'Домены / email' : 'Пригласительные ссылки'}
          </button>
        ))}
      </div>

      {section === 'templates' && (
        <div>
          {templates.length === 0 ? <div className="empty" style={{ padding: 48 }}>Нет шаблонов</div> : (
            <div style={{ display: 'grid', gap: 8 }}>
              {templates.map((t) => (
                <div key={t.id} style={{ padding: 12, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <strong>{t.name}</strong> · {t.type} · {t.subject}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'domain' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input placeholder="Домен или email" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} style={{ padding: 10, width: 240, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8 }} />
            <label><input type="checkbox" checked={domainAllow} onChange={(e) => setDomainAllow(e.target.checked)} /> Разрешить</label>
            <button onClick={addDomain} style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Добавить</button>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {domainList.map((d) => (
              <div key={d.id} style={{ padding: 10, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>{d.value} ({d.allow ? 'разрешён' : 'заблокирован'})</span>
                <button onClick={() => deleteDomain(d.id)} style={{ padding: '4px 10px', color: '#ef4444', border: '1px solid #ef4444', borderRadius: 6, cursor: 'pointer', background: 'transparent' }}>Удалить</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === 'invites' && (
        <div>
          <button onClick={() => setShowInviteForm(true)} style={{ marginBottom: 16, padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Создать ссылку</button>

          {showInviteForm && (
            <div style={{ padding: 20, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 16 }}>
              <h4 style={{ marginBottom: 12 }}>Новая пригласительная ссылка</h4>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Кто приглашает (отображается на странице приглашения)</label>
                <input value={inviterName} onChange={e => setInviterName(e.target.value)} placeholder="Например: Иван Петров" style={{ width: '100%', padding: 10, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8 }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Анкета / текст для пользователя (показывается при переходе по ссылке)</label>
                <textarea value={questionnaire} onChange={e => setQuestionnaire(e.target.value)} placeholder="Краткое описание или вопросы для приглашённого..." rows={4} style={{ width: '100%', padding: 10, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={createInvite} disabled={creatingInvite} style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: creatingInvite ? 'not-allowed' : 'pointer' }}>{creatingInvite ? 'Создание...' : 'Создать'}</button>
                <button onClick={() => { setShowInviteForm(false); setInviterName(''); setQuestionnaire(''); }} style={{ padding: '10px 20px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--fg)' }}>Отмена</button>
              </div>
            </div>
          )}

          {invites.length === 0 && !showInviteForm ? <div className="empty" style={{ padding: 48 }}>Нет ссылок</div> : (
            <div style={{ display: 'grid', gap: 8 }}>
              {invites.map((i) => {
                const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}/invite/${i.code}` : `/invite/${i.code}`;
                return (
                  <div key={i.id} style={{ padding: 12, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div><code>{i.code}</code> · использовано {i.usedCount}{i.maxUses ? ` / ${i.maxUses}` : ''} · {i.active ? 'активна' : 'отозвана'}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { navigator.clipboard.writeText(fullUrl); showToast('Ссылка скопирована', 'success'); }} style={{ padding: '6px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Копировать</button>
                      {i.active && <button onClick={() => revokeInvite(i.id)} style={{ padding: '6px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Отозвать</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
