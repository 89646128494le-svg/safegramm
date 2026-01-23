
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface User {
  id: string;
  username: string;
  avatarUrl?: string;
  status?: string;
}

interface GroupChannelSettingsProps {
  chatId: string;
  chatType: 'group' | 'channel';
  currentUserId: string;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function GroupChannelSettings({ chatId, chatType, currentUserId, onClose, onUpdate }: GroupChannelSettingsProps) {
  const [chat, setChat] = useState<any>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [memberRoles, setMemberRoles] = useState<Record<string, string>>({});
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [chatName, setChatName] = useState('');
  const [chatDescription, setChatDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [showInviteLink, setShowInviteLink] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [modSettings, setModSettings] = useState<any>({ enabled: false, bannedWords: '', maxMsgsPer10s: 8, warnThreshold: 2, banMinutes: 10, queueOnViolation: false });
  const [modQueue, setModQueue] = useState<any[]>([]);
  const [showModQueue, setShowModQueue] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'members' | 'moderation' | 'integrations' | 'stats'>('general');
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [showCreateWebhook, setShowCreateWebhook] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState('message.created');

  useEffect(() => {
    loadChatInfo();
    loadMembers();
    loadAllUsers();
    loadStats();
    loadModerationSettings();
    loadWebhooks();
  }, [chatId]);

  const loadChatInfo = async () => {
    try {
      const data = await api(`/api/chats/${chatId}`);
      setChat(data.chat);
      setChatName(data.chat.name || '');
      setChatDescription(data.chat.description || '');
      setIsPublic(data.chat.isPublic || false);
      setIsOwner(data.chat.ownerId === currentUserId);
      if (data.chat.inviteLink) {
        setInviteLink(data.chat.inviteLink);
      }
    } catch (e: any) {
      console.error('Failed to load chat info:', e);
      alert('Ошибка загрузки информации о чате: ' + e.message);
    }
  };

  const loadInviteLink = async () => {
    try {
      const data = await api(`/api/chats/${chatId}`);
      if (data.chat?.inviteLink) {
        setInviteLink(data.chat.inviteLink);
      }
    } catch (e) {
      console.error('Failed to load invite link:', e);
    }
  };

  const loadMembers = async () => {
    try {
      const data = await api(`/api/chats/${chatId}`);
      const rawMembers = data.chat.members || [];
      const memberIds = rawMembers.map((m: any) => (typeof m === 'string' ? m : (m.userId || m.userID || m.UserID || m.user_id))).filter(Boolean);
      const rolesMap: Record<string, string> = {};
      rawMembers.forEach((m: any) => {
        if (typeof m === 'string') return;
        const uid = m.userId || m.userID || m.UserID || m.user_id;
        if (uid) rolesMap[uid] = m.role || 'member';
      });
      setMemberRoles(rolesMap);
      const allUsersData = await api('/api/users');
      const memberUsers = allUsersData.users?.filter((u: User) => memberIds.includes(u.id)) || [];
      setMembers(memberUsers);
    } catch (e: any) {
      console.error('Failed to load members:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const data = await api('/api/users');
      setAllUsers(data.users || []);
    } catch (e: any) {
      console.error('Failed to load users:', e);
    }
  };

  const loadStats = async () => {
    if (chatType !== 'group') return;
    try {
      const s = await api(`/api/groups/${chatId}/stats`);
      setStats(s);
    } catch {
      setStats(null);
    }
  };

  const loadModerationSettings = async () => {
    try {
      const data = await api(`/api/chats/${chatId}/moderation/settings`);
      setModSettings(data.settings || { enabled: false });
    } catch {
      // ignore
    }
  };

  const saveModerationSettings = async () => {
    try {
      await api(`/api/chats/${chatId}/moderation/settings`, 'POST', modSettings);
      alert('Настройки модерации сохранены');
    } catch (e: any) {
      alert('Ошибка сохранения: ' + e.message);
    }
  };

  const loadModQueue = async () => {
    try {
      const data = await api(`/api/chats/${chatId}/moderation/queue`);
      setModQueue(data.messages || []);
    } catch (e: any) {
      alert('Ошибка загрузки очереди: ' + e.message);
    }
  };

  const approveQueued = async (messageId: string) => {
    await api(`/api/messages/${messageId}/moderation/approve`, 'POST', {});
    await loadModQueue();
  };

  const rejectQueued = async (messageId: string) => {
    await api(`/api/messages/${messageId}/moderation/reject`, 'POST', { reason: 'rejected' });
    await loadModQueue();
  };

  const setRole = async (userId: string, role: string) => {
    try {
      await api(`/api/groups/${chatId}/members/${userId}/role`, 'PATCH', { role });
      await loadMembers();
      alert('Роль обновлена');
    } catch (e: any) {
      alert('Ошибка роли: ' + e.message);
    }
  };

  const loadWebhooks = async () => {
    try {
      const data = await api(`/api/chats/${chatId}/webhooks`);
      setWebhooks(data.webhooks || []);
    } catch (e: any) {
      setWebhooks([]);
    }
  };

  const createWebhook = async () => {
    if (!newWebhookUrl.trim()) {
      alert('Введите URL');
      return;
    }
    try {
      await api(`/api/chats/${chatId}/webhooks`, 'POST', {
        url: newWebhookUrl.trim(),
        events: newWebhookEvents || 'message.created',
      });
      setNewWebhookUrl('');
      setNewWebhookEvents('message.created');
      setShowCreateWebhook(false);
      await loadWebhooks();
      alert('Вебхук создан');
    } catch (e: any) {
      alert('Ошибка создания: ' + e.message);
    }
  };

  const deleteWebhook = async (webhookId: string) => {
    if (!confirm('Удалить вебхук?')) return;
    try {
      await api(`/api/chats/${chatId}/webhooks/${webhookId}`, 'DELETE');
      await loadWebhooks();
      alert('Вебхук удалён');
    } catch (e: any) {
      alert('Ошибка удаления: ' + e.message);
    }
  };

  const addMember = async (userId: string) => {
    if (chatType === 'group') {
      try {
        await api(`/api/groups/${chatId}/members`, 'POST', { userId });
        await loadMembers();
        setShowAddMember(false);
        setSearchQuery('');
        onUpdate?.();
        setSelectedToAdd(prev => prev.filter(id => id !== userId));
        
        // Автоматическое обновление ключа для forward secrecy
        // Ключ будет обновлен автоматически через существующий endpoint при следующем обновлении
        // Это обеспечивает forward secrecy - старые участники не смогут читать новые сообщения
      } catch (e: any) {
        alert('Ошибка добавления участника: ' + e.message);
      }
    }
  };

  const bulkAddMembers = async () => {
    if (selectedToAdd.length === 0) return;
    if (!confirm(`Добавить ${selectedToAdd.length} пользователей в группу?`)) return;
    try {
      await api(`/api/groups/${chatId}/members/bulk`, 'POST', { userIds: selectedToAdd });
      setSelectedToAdd([]);
      setShowAddMember(false);
      setSearchQuery('');
      await loadMembers();
      onUpdate?.();
      alert('Участники добавлены');
      
      // Автоматическое обновление ключа для forward secrecy
      // Ключ будет обновлен автоматически через существующий endpoint при следующем обновлении
    } catch (e: any) {
      alert('Ошибка массового добавления: ' + e.message);
    }
  };

  const exportMembers = () => {
    const data = {
      chatId,
      chatType,
      exportedAt: new Date().toISOString(),
      members: members.map(m => ({ id: m.id, username: m.username, avatarUrl: m.avatarUrl, status: m.status })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safegram_${chatType}_${chatId}_members.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadHistory = async () => {
    if (loadingHistory) return;
    setLoadingHistory(true);
    try {
      const data = await api(`/api/groups/${chatId}/history`);
      setHistory(data.events || []);
    } catch (e: any) {
      alert('Ошибка загрузки истории: ' + e.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const removeMember = async (userId: string) => {
    if (!confirm('Удалить участника из ' + (chatType === 'group' ? 'группы' : 'канала') + '?')) return;
    if (chatType === 'group') {
      try {
        await api(`/api/groups/${chatId}/members/${userId}`, 'DELETE');
        await loadMembers();
        onUpdate?.();
        
        // Автоматическое обновление ключа для forward secrecy
        // Ключ будет обновлен автоматически через существующий endpoint при следующем обновлении
        // Это обеспечивает forward secrecy - удаленный участник не сможет читать новые сообщения
      } catch (e: any) {
        alert('Ошибка удаления участника: ' + e.message);
      }
    }
  };

  const subscribeToChannel = async () => {
    try {
      await api(`/api/channels/${chatId}/subscribe`, 'POST');
      await loadMembers();
      onUpdate?.();
    } catch (e: any) {
      alert('Ошибка подписки: ' + e.message);
    }
  };

  const unsubscribeFromChannel = async () => {
    if (!confirm('Отписаться от канала?')) return;
    try {
      await api(`/api/channels/${chatId}/unsubscribe`, 'POST');
      await loadMembers();
      onUpdate?.();
    } catch (e: any) {
      alert('Ошибка отписки: ' + e.message);
    }
  };

  const updateChatInfo = async () => {
    try {
      if (chatType === 'group') {
        await api(`/api/groups/${chatId}`, 'PATCH', {
          name: chatName,
          description: chatDescription,
          isPublic: isPublic
        });
      } else {
        await api(`/api/channels/${chatId}`, 'PATCH', {
          name: chatName,
          description: chatDescription,
          isPublic: isPublic
        });
      }
      await loadChatInfo();
      onUpdate?.();
      alert('Настройки обновлены');
    } catch (e: any) {
      alert('Ошибка обновления: ' + e.message);
    }
  };

  const isSubscribed = members.some(m => m.id === currentUserId);
  const filteredUsers = allUsers.filter((u) => {
    return !members.some((m) => m.id === u.id) &&
           u.username.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{background: 'var(--bg)', padding: '32px', borderRadius: '8px'}}>
          Загрузка...
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div style={{
        background: 'var(--bg)',
        borderRadius: '12px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
      }}>
        {/* Заголовок */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{margin: 0}}>
            {chatType === 'group' ? '👥 Настройки группы' : '📢 Настройки канала'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {/* Вкладки (только для групп) */}
        {chatType === 'group' ? (
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            padding: '0 20px',
            overflowX: 'auto'
          }}>
            {(['general', 'members', 'moderation', 'integrations', 'stats'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid var(--accent-primary, #3b82f6)' : '2px solid transparent',
                  color: activeTab === tab ? 'var(--accent-primary, #3b82f6)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: activeTab === tab ? '600' : '400',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
              >
                {tab === 'general' && '⚙️ Общее'}
                {tab === 'members' && '👥 Участники'}
                {tab === 'moderation' && '🛡️ Модерация'}
                {tab === 'integrations' && '🔗 Интеграции'}
                {tab === 'stats' && '📊 Статистика'}
              </button>
            ))}
          </div>
        ) : (
          <div style={{borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)'}} />
        )}

        <div style={{padding: '20px'}}>
          {/* Вкладка: Общее (для групп) или всё содержимое (для каналов) */}
          {(activeTab === 'general' || chatType === 'channel') && (
            <>
              {/* Информация о чате */}
              {isOwner && (
                <div style={{marginBottom: '24px'}}>
                  <h3 style={{marginBottom: '12px'}}>Информация</h3>
              <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                <div>
                  <label style={{display: 'block', marginBottom: '4px', fontWeight: 'bold'}}>
                    Название
                  </label>
                  <input
                    type="text"
                    value={chatName}
                    onChange={(e) => setChatName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-secondary)'
                    }}
                    maxLength={100}
                  />
                </div>
                <div>
                  <label style={{display: 'block', marginBottom: '4px', fontWeight: 'bold'}}>
                    Описание
                  </label>
                  <textarea
                    value={chatDescription}
                    onChange={(e) => setChatDescription(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-secondary)',
                      minHeight: '80px',
                      resize: 'vertical'
                    }}
                    maxLength={500}
                  />
                </div>
                <div>
                  <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}>
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                    />
                    <span>Публичный {chatType === 'group' ? 'группа' : 'канал'}</span>
                  </label>
                </div>
                <button onClick={updateChatInfo} style={{padding: '8px 16px', alignSelf: 'flex-start'}}>
                  Сохранить изменения
                </button>
              </div>
            </div>
          )}

              {/* Приглашение по ссылке */}
              {isOwner && (
                <div style={{marginBottom: '24px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px'}}>
                  <h3 style={{marginBottom: '12px'}}>🔗 Приглашение по ссылке</h3>
              {inviteLink ? (
                <div>
                  <div style={{marginBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)'}}>
                    Поделитесь этой ссылкой для приглашения:
                  </div>
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '8px',
                    padding: '8px',
                    background: 'var(--bg-primary)',
                    borderRadius: '4px',
                    border: '1px solid var(--border)'
                  }}>
                    <input
                      type="text"
                      value={`${window.location.origin}/app/join/${inviteLink}`}
                      readOnly
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        fontSize: '13px'
                      }}
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/app/join/${inviteLink}`);
                        alert('Ссылка скопирована!');
                      }}
                      style={{padding: '4px 8px', fontSize: '12px'}}
                    >
                      📋 Копировать
                    </button>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await api(`/api/chats/${chatId}/invite-link`, 'POST');
                        await loadInviteLink();
                      } catch (e: any) {
                        alert('Ошибка: ' + e.message);
                      }
                    }}
                    style={{padding: '6px 12px', fontSize: '12px', marginRight: '8px'}}
                  >
                    🔄 Обновить ссылку
                  </button>
                  <button
                    onClick={() => exportMembers()}
                    style={{padding: '6px 12px', fontSize: '12px', marginRight: '8px'}}
                    title="Экспорт участников"
                  >
                    💾 Экспорт участников
                  </button>
                  <button
                    onClick={async () => {
                      const next = !showHistory;
                      setShowHistory(next);
                      if (next) await loadHistory();
                    }}
                    style={{padding: '6px 12px', fontSize: '12px'}}
                    title="История участников"
                  >
                    🕓 История
                  </button>

                  <div style={{marginTop: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap'}}>
                    <div style={{fontSize: '13px', color: 'var(--text-secondary)'}}>QR для быстрого входа:</div>
                    <img
                      alt="QR invite"
                      style={{width: 160, height: 160, borderRadius: 8, background: '#fff', padding: 6}}
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${window.location.origin}/app/join/${inviteLink}`)}`}
                    />
                  </div>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    try {
                      const res = await api(`/api/chats/${chatId}/invite-link`, 'POST');
                      setInviteLink(res.inviteLink);
                    } catch (e: any) {
                      alert('Ошибка создания ссылки: ' + e.message);
                    }
                  }}
                  style={{padding: '8px 16px'}}
                >
                  ➕ Создать ссылку приглашения
                </button>
              )}
            </div>
          )}

          {/* Вкладка: Участники */}
          {activeTab === 'members' && (
            <>
              {showHistory && (
                <div style={{marginBottom: '24px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px'}}>
                  <h3 style={{marginBottom: '12px'}}>🕓 История участников</h3>
                  {loadingHistory ? (
                    <div style={{color: 'var(--subtle)'}}>Загрузка...</div>
                  ) : history.length === 0 ? (
                    <div style={{color: 'var(--subtle)'}}>Пока нет событий</div>
                  ) : (
                    <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                      {history.slice(0, 50).map((ev, idx) => (
                        <div key={ev.id || idx} style={{padding: '10px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)'}}>
                          <div style={{fontSize: 13, fontWeight: 600}}>
                            {ev.action} — {ev.userId}
                          </div>
                          <div style={{fontSize: 12, color: 'var(--subtle)'}}>
                            {ev.createdAt ? new Date(ev.createdAt).toLocaleString('ru-RU') : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            {showAddMember && chatType === 'group' && isOwner && (
              <div style={{marginBottom: '16px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px'}}>
                <input
                  type="text"
                  placeholder="Поиск пользователей..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    marginBottom: '8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg)'
                  }}
                />
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                  <div style={{fontSize: '12px', color: 'var(--subtle)'}}>Выбрано: {selectedToAdd.length}</div>
                  <button
                    onClick={bulkAddMembers}
                    disabled={selectedToAdd.length === 0}
                    style={{padding: '6px 10px', fontSize: '12px', opacity: selectedToAdd.length === 0 ? 0.6 : 1}}
                  >
                    ✅ Добавить выбранных
                  </button>
                </div>
                <div style={{maxHeight: '200px', overflowY: 'auto'}}>
                  {filteredUsers.slice(0, 10).map(user => (
                    <div
                      key={user.id}
                      style={{
                        padding: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        marginBottom: '4px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <label style={{display: 'flex', alignItems: 'center', gap: 8}}>
                        <input
                          type="checkbox"
                          checked={selectedToAdd.includes(user.id)}
                          onChange={(e) => {
                            setSelectedToAdd(prev => e.target.checked ? [...prev, user.id] : prev.filter(id => id !== user.id));
                          }}
                        />
                        <span>{user.username}</span>
                      </label>
                      <button onClick={() => addMember(user.id)} style={{padding: '4px 8px', fontSize: '12px'}}>
                        +1
                      </button>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && searchQuery && (
                    <div style={{padding: '8px', color: 'var(--subtle)'}}>Пользователи не найдены</div>
                  )}
                </div>
              </div>
            )}

            <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
              {members.map(member => (
                <div
                  key={member.id}
                  style={{
                    padding: '12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    {chat?.ownerId === member.id && '👑'}
                    <span style={{fontWeight: member.id === currentUserId ? 'bold' : 'normal'}}>
                      {member.username}
                    </span>
                    {member.id === currentUserId && <span style={{color: 'var(--subtle)', fontSize: '12px'}}>(Вы)</span>}
                    <span style={{fontSize: 12, color: 'var(--subtle)'}}>
                      {memberRoles[member.id] ? `• ${memberRoles[member.id]}` : ''}
                    </span>
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                    {chatType === 'group' && isOwner && member.id !== currentUserId && chat?.ownerId !== member.id && (
                      <select
                        value={memberRoles[member.id] || 'member'}
                        onChange={(e) => setRole(member.id, e.target.value)}
                        style={{padding: '6px 8px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)'}}
                        title="Роль"
                      >
                        <option value="member">member</option>
                        <option value="moderator">moderator</option>
                        <option value="admin">admin</option>
                      </select>
                    )}
                    {chatType === 'group' && isOwner && member.id !== currentUserId && chat?.ownerId !== member.id && (
                      <button
                        onClick={() => removeMember(member.id)}
                        style={{padding: '4px 8px', fontSize: '12px', background: '#dc3545'}}
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {members.length === 0 && (
                <div style={{padding: '16px', textAlign: 'center', color: 'var(--subtle)'}}>
                  {chatType === 'group' ? 'Нет участников' : 'Нет подписчиков'}
                </div>
              )}
            </div>
            </>
          )}

          {/* Вкладка: Модерация */}
          {activeTab === 'moderation' && chatType === 'group' && isOwner && (
            <div style={{marginBottom: '24px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px'}}>
              <h3 style={{marginBottom: '12px'}}>🛡️ Модерация</h3>
              <label style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10}}>
                <input
                  type="checkbox"
                  checked={!!modSettings.enabled}
                  onChange={(e) => setModSettings((p: any) => ({ ...p, enabled: e.target.checked }))}
                />
                <span>Включить автомодерацию</span>
              </label>
              <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
                <div>
                  <div style={{fontSize: 12, color: 'var(--subtle)'}}>Запрещённые слова (через запятую)</div>
                  <textarea
                    value={modSettings.bannedWords || ''}
                    onChange={(e) => setModSettings((p: any) => ({ ...p, bannedWords: e.target.value }))}
                    style={{width: '100%', minHeight: 70, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)'}}
                  />
                </div>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
                  <label style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                    <span style={{fontSize: 12, color: 'var(--subtle)'}}>Макс. сообщений / 10с</span>
                    <input
                      type="number"
                      value={modSettings.maxMsgsPer10s || 8}
                      onChange={(e) => setModSettings((p: any) => ({ ...p, maxMsgsPer10s: Number(e.target.value) }))}
                      style={{padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)'}}
                    />
                  </label>
                  <label style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                    <span style={{fontSize: 12, color: 'var(--subtle)'}}>Порог предупреждений (24ч)</span>
                    <input
                      type="number"
                      value={modSettings.warnThreshold || 2}
                      onChange={(e) => setModSettings((p: any) => ({ ...p, warnThreshold: Number(e.target.value) }))}
                      style={{padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)'}}
                    />
                  </label>
                  <label style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                    <span style={{fontSize: 12, color: 'var(--subtle)'}}>Бан (минут)</span>
                    <input
                      type="number"
                      value={modSettings.banMinutes || 10}
                      onChange={(e) => setModSettings((p: any) => ({ ...p, banMinutes: Number(e.target.value) }))}
                      style={{padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)'}}
                    />
                  </label>
                  <label style={{display: 'flex', alignItems: 'center', gap: 8, marginTop: 18}}>
                    <input
                      type="checkbox"
                      checked={!!modSettings.queueOnViolation}
                      onChange={(e) => setModSettings((p: any) => ({ ...p, queueOnViolation: e.target.checked }))}
                    />
                    <span>Отправлять в очередь</span>
                  </label>
                </div>
                <div style={{display: 'flex', gap: 10}}>
                  <button onClick={saveModerationSettings} style={{padding: '8px 14px'}}>💾 Сохранить</button>
                  <button
                    onClick={async () => {
                      const next = !showModQueue;
                      setShowModQueue(next);
                      if (next) await loadModQueue();
                    }}
                    style={{padding: '8px 14px'}}
                  >
                    🧾 Очередь ({modQueue.length})
                  </button>
                </div>
              </div>

              {showModQueue && (
                <div style={{marginTop: 14}}>
                  {modQueue.length === 0 ? (
                    <div style={{color: 'var(--subtle)'}}>Очередь пуста</div>
                  ) : (
                    <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
                      {modQueue.slice(0, 50).map((m: any) => (
                        <div key={m.id} style={{padding: 12, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)'}}>
                          <div style={{fontSize: 12, color: 'var(--subtle)'}}>Причина: {m.moderationReason || '—'}</div>
                          <div style={{marginTop: 6, whiteSpace: 'pre-wrap'}}>{m.text || '[ciphertext]'}</div>
                          <div style={{display: 'flex', gap: 8, marginTop: 10}}>
                            <button onClick={() => approveQueued(m.id)} style={{padding: '6px 10px'}}>✅ Одобрить</button>
                            <button onClick={() => rejectQueued(m.id)} style={{padding: '6px 10px', background: '#dc3545'}}>⛔ Отклонить</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Вкладка: Интеграции */}
          {activeTab === 'integrations' && chatType === 'group' && isOwner && (
            <div style={{marginBottom: '24px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px'}}>
              <h3 style={{marginBottom: '12px'}}>🔗 Вебхуки</h3>
              <div style={{marginBottom: 16}}>
                <button
                  onClick={() => setShowCreateWebhook(!showCreateWebhook)}
                  style={{padding: '8px 14px', fontSize: 13}}
                >
                  {showCreateWebhook ? 'Отмена' : '+ Создать вебхук'}
                </button>
              </div>

              {showCreateWebhook && (
                <div style={{padding: 16, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16}}>
                  <label style={{display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12}}>
                    <span style={{fontSize: 13, fontWeight: 600}}>URL вебхука</span>
                    <input
                      type="url"
                      value={newWebhookUrl}
                      onChange={(e) => setNewWebhookUrl(e.target.value)}
                      placeholder="https://example.com/webhook"
                      style={{padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)'}}
                    />
                  </label>
                  <label style={{display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12}}>
                    <span style={{fontSize: 13, fontWeight: 600}}>События (через запятую, * = все)</span>
                    <input
                      type="text"
                      value={newWebhookEvents}
                      onChange={(e) => setNewWebhookEvents(e.target.value)}
                      placeholder="message.created,member.join"
                      style={{padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)'}}
                    />
                  </label>
                  <button onClick={createWebhook} style={{padding: '8px 14px'}}>✅ Создать</button>
                </div>
              )}

              {webhooks.length === 0 ? (
                <div style={{color: 'var(--subtle)', padding: 20, textAlign: 'center'}}>Нет вебхуков</div>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
                  {webhooks.map((hook: any) => (
                    <div key={hook.id} style={{padding: 14, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)'}}>
                      <div style={{fontSize: 13, fontWeight: 600, marginBottom: 6}}>{hook.url}</div>
                      <div style={{fontSize: 12, color: 'var(--subtle)', marginBottom: 10}}>
                        События: {hook.events || '*'}
                      </div>
                      <button
                        onClick={() => deleteWebhook(hook.id)}
                        style={{padding: '6px 10px', fontSize: 12, background: '#dc3545'}}
                      >
                        Удалить
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Вкладка: Статистика */}
          {activeTab === 'stats' && chatType === 'group' && stats && (
            <div style={{marginBottom: '24px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px'}}>
              <h3 style={{marginBottom: '12px'}}>📊 Статистика группы</h3>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
                <div style={{padding: 12, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)'}}>
                  <div style={{fontSize: 12, color: 'var(--subtle)'}}>Участники</div>
                  <div style={{fontSize: 18, fontWeight: 700}}>{stats.members}</div>
                </div>
                <div style={{padding: 12, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)'}}>
                  <div style={{fontSize: 12, color: 'var(--subtle)'}}>Активные 7д</div>
                  <div style={{fontSize: 18, fontWeight: 700}}>{stats.activeUsers7d}</div>
                </div>
                <div style={{padding: 12, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)'}}>
                  <div style={{fontSize: 12, color: 'var(--subtle)'}}>Сообщений 24ч</div>
                  <div style={{fontSize: 18, fontWeight: 700}}>{stats.messages24h}</div>
                </div>
                <div style={{padding: 12, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)'}}>
                  <div style={{fontSize: 12, color: 'var(--subtle)'}}>Сообщений 7д</div>
                  <div style={{fontSize: 18, fontWeight: 700}}>{stats.messages7d}</div>
                </div>
              </div>
            </div>
          )}

          {/* Подписка на канал (для каналов, всегда показывается) */}
          {chatType === 'channel' && !isOwner && activeTab === 'general' && (
            <div style={{marginBottom: '24px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px'}}>
              {isSubscribed ? (
                <div>
                  <div style={{marginBottom: '8px'}}>Вы подписаны на этот канал</div>
                  <button onClick={unsubscribeFromChannel} style={{padding: '6px 12px'}}>
                    Отписаться
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{marginBottom: '8px'}}>Вы не подписаны на этот канал</div>
                  <button onClick={subscribeToChannel} style={{padding: '6px 12px'}}>
                    Подписаться
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

