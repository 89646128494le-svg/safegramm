
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
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [chatName, setChatName] = useState('');
  const [chatDescription, setChatDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    loadChatInfo();
    loadMembers();
    loadAllUsers();
  }, [chatId]);

  const loadChatInfo = async () => {
    try {
      const data = await api(`/api/chats/${chatId}`);
      setChat(data.chat);
      setChatName(data.chat.name || '');
      setChatDescription(data.chat.description || '');
      setIsPublic(data.chat.isPublic || false);
      setIsOwner(data.chat.ownerId === currentUserId);
    } catch (e: any) {
      console.error('Failed to load chat info:', e);
      alert('Ошибка загрузки информации о чате: ' + e.message);
    }
  };

  const loadMembers = async () => {
    try {
      const data = await api(`/api/chats/${chatId}`);
      const memberIds = data.chat.members || [];
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

  const addMember = async (userId: string) => {
    if (chatType === 'group') {
      try {
        await api(`/api/groups/${chatId}/members`, 'POST', { userId });
        await loadMembers();
        setShowAddMember(false);
        setSearchQuery('');
        onUpdate?.();
      } catch (e: any) {
        alert('Ошибка добавления участника: ' + e.message);
      }
    }
  };

  const removeMember = async (userId: string) => {
    if (!confirm('Удалить участника из ' + (chatType === 'group' ? 'группы' : 'канала') + '?')) return;
    if (chatType === 'group') {
      try {
        await api(`/api/groups/${chatId}/members/${userId}`, 'DELETE');
        await loadMembers();
        onUpdate?.();
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
  const filteredUsers = allUsers.filter(u => 
    !members.some(m => m.id === u.id) &&
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

        <div style={{padding: '20px'}}>
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

          {/* Подписка на канал */}
          {chatType === 'channel' && !isOwner && (
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

          {/* Участники */}
          <div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
              <h3 style={{margin: 0}}>
                {chatType === 'group' ? 'Участники' : 'Подписчики'} ({members.length})
              </h3>
              {chatType === 'group' && isOwner && (
                <button onClick={() => setShowAddMember(!showAddMember)} style={{padding: '6px 12px', fontSize: '13px'}}>
                  {showAddMember ? 'Отмена' : '+ Добавить'}
                </button>
              )}
            </div>

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
                      <span>{user.username}</span>
                      <button onClick={() => addMember(user.id)} style={{padding: '4px 8px', fontSize: '12px'}}>
                        Добавить
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
                  </div>
                  {chatType === 'group' && isOwner && member.id !== currentUserId && chat?.ownerId !== member.id && (
                    <button
                      onClick={() => removeMember(member.id)}
                      style={{padding: '4px 8px', fontSize: '12px', background: '#dc3545'}}
                    >
                      Удалить
                    </button>
                  )}
                </div>
              ))}
              {members.length === 0 && (
                <div style={{padding: '16px', textAlign: 'center', color: 'var(--subtle)'}}>
                  {chatType === 'group' ? 'Нет участников' : 'Нет подписчиков'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

