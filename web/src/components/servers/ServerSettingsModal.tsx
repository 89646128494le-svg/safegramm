import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { showToast } from '../Toast';

interface ServerSettingsModalProps {
  serverId: string;
  server: { id: string; name: string; description?: string; iconUrl?: string; inviteLink?: string };
  currentUserRole: string;
  currentUserId?: string;
  onClose: () => void;
  onSaved: () => void;
}

type Tab = 'overview' | 'roles' | 'members';

const PERM_LABELS: Record<string, string> = {
  manage_server: 'Управление сервером',
  manage_roles: 'Управление ролями',
  manage_channels: 'Управление каналами',
  manage_invites: 'Управление приглашениями',
  kick_members: 'Исключать участников',
  ban_members: 'Банить участников',
  change_nickname: 'Менять свой ник',
  manage_nicknames: 'Управление никами',
  send_messages: 'Отправлять сообщения',
  manage_messages: 'Удалять сообщения',
  embed_links: 'Встраивать ссылки',
  attach_files: 'Прикреплять файлы',
  read_history: 'Читать историю',
  mention_everyone: 'Упоминать @everyone',
  voice_connect: 'Подключаться к голосу',
  voice_speak: 'Говорить в голосе',
  voice_mute_members: 'Отключать другим микрофон',
};

export default function ServerSettingsModal({ serverId, server, currentUserRole, currentUserId, onClose, onSaved }: ServerSettingsModalProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const [name, setName] = useState(server.name);
  const [description, setDescription] = useState(server.description || '');
  const [iconUrl, setIconUrl] = useState(server.iconUrl || '');
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<{ id: string; name: string; color: string; position: number; permissions: string[] }[]>([]);
  const [allPermissions, setAllPermissions] = useState<string[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('99aab5');
  const [creatingRole, setCreatingRole] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [members, setMembers] = useState<{ userId: string; username: string; role: string; roles: { id: string; name: string; color: string }[] }[]>([]);
  const [memberRolesEdit, setMemberRolesEdit] = useState<{ userId: string; roleIds: string[] } | null>(null);
  const [savingMemberRoles, setSavingMemberRoles] = useState(false);

  const canEdit = currentUserRole === 'owner' || currentUserRole === 'admin';

  useEffect(() => {
    if (serverId && canEdit && tab === 'roles') {
      api(`/api/servers/${serverId}/roles`).then((data: any) => {
        setRoles(data.roles || []);
        setAllPermissions(data.allPermissions || []);
      }).catch(() => {});
    }
  }, [serverId, canEdit, tab]);

  useEffect(() => {
    if (serverId && tab === 'members') {
      api(`/api/servers/${serverId}/members`).then((data: any) => {
        const raw = data.members || [];
        setMembers(raw.map((m: any) => ({
          userId: m.userId ?? m.id,
          username: m.user?.username ?? m.username ?? '?',
          role: m.role ?? 'member',
          roles: m.roles || [],
        })));
      }).catch(() => {});
    }
  }, [serverId, tab]);

  const saveOverview = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await api(`/api/servers/${serverId}`, 'PATCH', {
        name: name.trim() || server.name,
        description: description.trim() || undefined,
        iconUrl: iconUrl.trim() || undefined,
      });
      showToast('Настройки сохранены', 'success');
      onSaved();
    } catch (e: any) {
      showToast(e?.message || 'Ошибка сохранения', 'error');
    } finally {
      setSaving(false);
    }
  };

  const createRole = async () => {
    if (!newRoleName.trim()) {
      showToast('Введите название роли', 'warning');
      return;
    }
    setCreatingRole(true);
    try {
      await api(`/api/servers/${serverId}/roles`, 'POST', {
        name: newRoleName.trim(),
        color: newRoleColor,
        permissions: [],
      });
      setNewRoleName('');
      const data = await api(`/api/servers/${serverId}/roles`);
      setRoles(data.roles || []);
      showToast('Роль создана', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Ошибка создания роли', 'error');
    } finally {
      setCreatingRole(false);
    }
  };

  const deleteRole = async (roleId: string) => {
    if (!confirm('Удалить эту роль?')) return;
    try {
      await api(`/api/servers/${serverId}/roles/${roleId}`, 'DELETE');
      setRoles(prev => prev.filter(r => r.id !== roleId));
      setEditingRoleId(null);
      showToast('Роль удалена', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Ошибка удаления', 'error');
    }
  };

  const updateRolePermissions = async (roleId: string, permissions: string[]) => {
    try {
      await api(`/api/servers/${serverId}/roles/${roleId}`, 'PATCH', { permissions });
      setRoles(prev => prev.map(r => r.id === roleId ? { ...r, permissions } : r));
      setEditingRoleId(null);
      showToast('Права роли сохранены', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Ошибка сохранения прав', 'error');
    }
  };

  const toggleRolePerm = (roleId: string, perm: string) => {
    const role = roles.find(r => r.id === roleId);
    if (!role) return;
    const next = role.permissions?.includes(perm)
      ? (role.permissions || []).filter(p => p !== perm)
      : [...(role.permissions || []), perm];
    setRoles(prev => prev.map(r => r.id === roleId ? { ...r, permissions: next } : r));
  };

  const saveMemberRoles = async () => {
    if (!memberRolesEdit) return;
    setSavingMemberRoles(true);
    try {
      await api(`/api/servers/${serverId}/members/${memberRolesEdit.userId}/roles`, 'PUT', { roleIds: memberRolesEdit.roleIds });
      showToast('Роли участника обновлены', 'success');
      setMemberRolesEdit(null);
      const data = await api(`/api/servers/${serverId}/members`);
      const raw = data.members || [];
      setMembers(raw.map((m: any) => ({
        userId: m.userId ?? m.id,
        username: m.user?.username ?? m.username ?? '?',
        role: m.role ?? 'member',
        roles: m.roles || [],
      })));
      onSaved();
    } catch (e: any) {
      showToast(e?.message || 'Ошибка сохранения', 'error');
    } finally {
      setSavingMemberRoles(false);
    }
  };

  if (!canEdit) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: '16px',
        width: '90%',
        maxWidth: '560px',
        maxHeight: '85vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--border)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Настройки сервера</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-secondary)' }}>×</button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {(['overview', 'roles', 'members'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '12px 20px',
                background: tab === t ? 'var(--accent)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '14px',
              }}
            >
              {t === 'overview' ? 'Обзор' : t === 'roles' ? 'Роли' : 'Участники'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Название</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  placeholder="Название сервера"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Описание</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', resize: 'vertical' }}
                  placeholder="Описание сервера"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Ссылка на иконку (URL)</label>
                <input
                  value={iconUrl}
                  onChange={e => setIconUrl(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  placeholder="https://..."
                />
              </div>
              {server.inviteLink && (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Приглашение</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      readOnly
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/app/servers/join/${server.inviteLink}`}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '12px' }}
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/app/servers/join/${server.inviteLink}`);
                        showToast('Скопировано', 'success');
                      }}
                      style={{ padding: '8px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}
                    >
                      Копировать
                    </button>
                  </div>
                </div>
              )}
              <button onClick={saveOverview} disabled={saving} style={{ padding: '12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', cursor: saving ? 'wait' : 'pointer', fontWeight: '600' }}>
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          )}

          {tab === 'roles' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  value={newRoleName}
                  onChange={e => setNewRoleName(e.target.value)}
                  placeholder="Название роли"
                  style={{ flex: '1', minWidth: '140px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
                <input
                  type="color"
                  value={`#${newRoleColor}`}
                  onChange={e => setNewRoleColor(e.target.value.slice(1))}
                  title="Цвет"
                  style={{ width: 40, height: 36, padding: 2, border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer' }}
                />
                <button onClick={createRole} disabled={creatingRole} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>
                  Создать роль
                </button>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Доступные права: {allPermissions.join(', ')}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {roles.map(r => (
                  <li
                    key={r.id}
                    style={{
                      padding: '10px 12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '8px',
                      marginBottom: '8px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: 12, height: 12, borderRadius: '50%', background: `#${r.color}` }} />
                        <span style={{ fontWeight: '500' }}>{r.name}</span>
                        {r.permissions?.length > 0 && (
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>({r.permissions.length} прав)</span>
                        )}
                      </span>
                      <span style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => setEditingRoleId(editingRoleId === r.id ? null : r.id)}
                          style={{ padding: '4px 10px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          {editingRoleId === r.id ? 'Свернуть' : 'Права'}
                        </button>
                        <button
                          onClick={() => deleteRole(r.id)}
                          style={{ padding: '4px 10px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Удалить
                        </button>
                      </span>
                    </div>
                    {editingRoleId === r.id && (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>Права роли</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                          {allPermissions.map(perm => (
                            <label key={perm} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                              <input
                                type="checkbox"
                                checked={(r.permissions || []).includes(perm)}
                                onChange={() => toggleRolePerm(r.id, perm)}
                              />
                              {PERM_LABELS[perm] || perm}
                            </label>
                          ))}
                        </div>
                        <button
                          onClick={() => updateRolePermissions(r.id, r.permissions || [])}
                          style={{ marginTop: '10px', padding: '8px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Сохранить права
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {roles.length === 0 && !creatingRole && <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Нет ролей. Создайте роль выше.</div>}
            </div>
          )}

          {tab === 'members' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {memberRolesEdit && (
                <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ marginBottom: '8px', fontWeight: '600' }}>Роли для участника</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                    {roles.map(role => (
                      <label key={role.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '13px' }}>
                        <input
                          type="checkbox"
                          checked={memberRolesEdit.roleIds.includes(role.id)}
                          onChange={() => {
                            setMemberRolesEdit(prev => !prev ? null : {
                              ...prev,
                              roleIds: prev.roleIds.includes(role.id)
                                ? prev.roleIds.filter(id => id !== role.id)
                                : [...prev.roleIds, role.id],
                            });
                          }}
                        />
                        <span style={{ padding: '2px 6px', borderRadius: '4px', background: `#${(role.color || '').replace(/^#/, '')}20`, color: `#${(role.color || '').replace(/^#/, '')}` }}>{role.name}</span>
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={saveMemberRoles} disabled={savingMemberRoles} style={{ padding: '6px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                      {savingMemberRoles ? 'Сохранение...' : 'Сохранить'}
                    </button>
                    <button onClick={() => setMemberRolesEdit(null)} style={{ padding: '6px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>Отмена</button>
                  </div>
                </div>
              )}
              {members.map(m => (
                <div
                  key={m.userId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: '500' }}>{m.username}</span>
                    {m.role === 'owner' && <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(251,191,36,0.2)', color: '#fbbf24' }}>👑 Владелец</span>}
                    {m.role === 'admin' && <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(124,108,255,0.2)', color: '#a78bfa' }}>Админ</span>}
                    {m.roles?.map(role => (
                      <span key={role.id} style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: `#${(role.color || '').replace(/^#/, '')}20`, color: `#${(role.color || '').replace(/^#/, '')}` }}>{role.name}</span>
                    ))}
                  </div>
                  {m.role !== 'owner' && (
                    <button
                      onClick={() => setMemberRolesEdit({ userId: m.userId, roleIds: (m.roles || []).map((r: { id: string }) => r.id) })}
                      style={{ padding: '4px 10px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                    >
                      Роли
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
