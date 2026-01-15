
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { showToast } from '../../components/Toast';
import { ConfirmModal, PromptModal } from '../../components/Modal';

interface Server {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: number;
}

interface Channel {
  id: string;
  serverId: string;
  name: string;
  type: 'text' | 'voice';
  position: number;
}

interface Member {
  id: string;
  username: string;
  avatarUrl?: string;
  role: string;
}

export default function ServerView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [server, setServer] = useState<Server | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'text' | 'voice'>('text');
  const [confirmDelete, setConfirmDelete] = useState<{open: boolean, channelId: string, channelName: string}>({
    open: false,
    channelId: '',
    channelName: ''
  });

  useEffect(() => {
    if (id) {
      loadServer();
      loadChannels();
      loadMembers();
    }
  }, [id]);

  const loadServer = async () => {
    try {
      const data = await api(`/api/servers/${id}`);
      setServer(data.server);
    } catch (e: any) {
      console.error('Failed to load server:', e);
      showToast('Ошибка загрузки сервера: ' + e.message, 'error');
      navigate('/app/servers');
    }
  };

  const loadChannels = async () => {
    try {
      const data = await api(`/api/servers/${id}/channels`);
      setChannels(data.channels || []);
      if (data.channels && data.channels.length > 0 && !selectedChannelId) {
        setSelectedChannelId(data.channels[0].id);
      }
    } catch (e: any) {
      console.error('Failed to load channels:', e);
      showToast('Ошибка загрузки каналов: ' + e.message, 'error');
    }
  };

  const loadMembers = async () => {
    try {
      const data = await api(`/api/servers/${id}/members`);
      setMembers(data.members || []);
    } catch (e: any) {
      console.error('Failed to load members:', e);
    } finally {
      setLoading(false);
    }
  };

  const createChannel = async (name: string) => {
    if (!name.trim()) {
      showToast('Введите название канала', 'warning');
      return;
    }
    try {
      await api(`/api/servers/${id}/channels`, 'POST', {
        name: name.trim(),
        type: newChannelType
      });
      setNewChannelName('');
      setShowCreateChannel(false);
      showToast(`Канал "${name.trim()}" создан`, 'success');
      await loadChannels();
    } catch (e: any) {
      showToast('Ошибка создания канала: ' + e.message, 'error');
    }
  };

  const deleteChannel = async (channelId: string) => {
    try {
      await api(`/api/servers/${id}/channels/${channelId}`, 'DELETE');
      showToast('Канал удалён', 'success');
      await loadChannels();
      if (selectedChannelId === channelId) {
        setSelectedChannelId('');
      }
      setConfirmDelete({ open: false, channelId: '', channelName: '' });
    } catch (e: any) {
      showToast('Ошибка удаления канала: ' + e.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="empty" style={{padding: '48px'}}>Загрузка...</div>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="container">
        <div className="empty" style={{padding: '48px'}}>
          Сервер не найден
          <button 
            onClick={() => navigate('/app/servers')}
            style={{
              marginTop: '16px',
              padding: '10px 20px',
              background: 'var(--accent, #3b82f6)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Вернуться к серверам
          </button>
        </div>
      </div>
    );
  }

  const textChannels = channels.filter(c => c.type === 'text').sort((a, b) => a.position - b.position);
  const voiceChannels = channels.filter(c => c.type === 'voice').sort((a, b) => a.position - b.position);

  return (
    <div className="container">
      <div className="sidebar" style={{width: '260px'}}>
        <div style={{marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border, #374151)'}}>
          <div style={{fontSize: '20px', fontWeight: '700', marginBottom: '4px'}}>{server.name}</div>
          {server.description && (
            <div className="small" style={{color: 'var(--subtle, #9ca3af)'}}>
              {server.description}
            </div>
          )}
        </div>

        <div style={{marginBottom: '20px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
            <div className="small" style={{color: 'var(--subtle, #9ca3af)', fontWeight: '600', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px'}}>
              ТЕКСТОВЫЕ КАНАЛЫ
            </div>
            <button
              onClick={() => setShowCreateChannel(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--subtle, #9ca3af)',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '0',
                width: '20px',
                height: '20px'
              }}
              title="Создать канал"
            >
              +
            </button>
          </div>
          {textChannels.length === 0 ? (
            <div className="small" style={{color: 'var(--subtle, #9ca3af)', fontStyle: 'italic', padding: '8px'}}>
              Нет каналов
            </div>
          ) : (
            textChannels.map(channel => (
              <div
                key={channel.id}
                onClick={() => setSelectedChannelId(channel.id)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: selectedChannelId === channel.id ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                  color: selectedChannelId === channel.id ? 'var(--accent, #3b82f6)' : 'var(--fg, #e5e7eb)',
                  marginBottom: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
                onMouseEnter={(e) => {
                  if (selectedChannelId !== channel.id) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedChannelId !== channel.id) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span># {channel.name}</span>
              </div>
            ))
          )}
        </div>

        <div style={{marginBottom: '20px'}}>
          <div className="small" style={{color: 'var(--subtle, #9ca3af)', fontWeight: '600', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', marginBottom: '12px'}}>
            ГОЛОСОВЫЕ КАНАЛЫ
          </div>
          {voiceChannels.length === 0 ? (
            <div className="small" style={{color: 'var(--subtle, #9ca3af)', fontStyle: 'italic', padding: '8px'}}>
              Нет каналов
            </div>
          ) : (
            voiceChannels.map(channel => (
              <div
                key={channel.id}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  color: 'var(--fg, #e5e7eb)',
                  marginBottom: '4px'
                }}
              >
                🔊 {channel.name}
              </div>
            ))
          )}
        </div>

        <hr style={{margin: '20px 0'}} />

        <div>
          <div className="small" style={{color: 'var(--subtle, #9ca3af)', fontWeight: '600', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', marginBottom: '12px'}}>
            УЧАСТНИКИ — {members.length}
          </div>
          {members.length === 0 ? (
            <div className="small" style={{color: 'var(--subtle, #9ca3af)', fontStyle: 'italic', padding: '8px'}}>
              Нет участников
            </div>
          ) : (
            members.map(member => (
              <div
                key={member.id}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--accent, #3b82f6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '600',
                  fontSize: '14px',
                  flexShrink: 0
                }}>
                  {member.username[0].toUpperCase()}
                </div>
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={{fontSize: '14px', fontWeight: '500'}}>{member.username}</div>
                  <div className="small" style={{color: 'var(--subtle, #9ca3af)'}}>
                    {member.role === 'owner' ? '👑 Владелец' : member.role === 'admin' ? '⚡ Админ' : '👤 Участник'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="main">
        {selectedChannelId ? (
          <div style={{
            padding: '24px',
            background: 'var(--panel, rgba(31, 41, 55, 0.6))',
            borderRadius: '12px',
            height: '100%'
          }}>
            <div style={{fontSize: '24px', fontWeight: '600', marginBottom: '16px'}}>
              Канал: #{channels.find(c => c.id === selectedChannelId)?.name || 'Неизвестный'}
            </div>
            <div className="empty" style={{padding: '48px'}}>
              Чат в каналах серверов будет добавлен в следующих версиях
            </div>
          </div>
        ) : (
          <div className="empty" style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px'}}>
            <div style={{fontSize: '64px'}}>📢</div>
            <div style={{fontSize: '24px', fontWeight: 'bold'}}>Выберите канал</div>
            <div style={{color: 'var(--subtle, #9ca3af)', fontSize: '16px'}}>
              Выберите канал из списка слева или создайте новый
            </div>
          </div>
        )}
      </div>

      <PromptModal
        isOpen={showCreateChannel}
        onClose={() => {
          setShowCreateChannel(false);
          setNewChannelName('');
          setNewChannelType('text');
        }}
        onConfirm={(name) => createChannel(name)}
        title="Создать канал"
        message={
          <div style={{display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px'}}>
            <div>Введите название канала:</div>
            <select
              value={newChannelType}
              onChange={e => setNewChannelType(e.target.value as 'text' | 'voice')}
              style={{
                padding: '10px',
                background: 'var(--panel-2, #111827)',
                border: '1px solid var(--border, #374151)',
                borderRadius: '8px',
                color: 'var(--fg, #e5e7eb)',
                cursor: 'pointer'
              }}
            >
              <option value="text">💬 Текстовый канал</option>
              <option value="voice">🔊 Голосовой канал</option>
            </select>
          </div>
        }
        placeholder="Название канала"
        defaultValue=""
        confirmText="Создать"
        cancelText="Отмена"
      />

      <ConfirmModal
        isOpen={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, channelId: '', channelName: '' })}
        onConfirm={() => deleteChannel(confirmDelete.channelId)}
        title="Удалить канал"
        message={`Вы уверены, что хотите удалить канал "${confirmDelete.channelName}"? Это действие нельзя отменить.`}
        confirmText="Удалить"
        cancelText="Отмена"
        danger={true}
      />
    </div>
  );
}
