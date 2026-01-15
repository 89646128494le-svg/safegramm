
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { showToast } from '../../components/Toast';
import { Modal } from '../../components/Modal';

interface Server {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  iconUrl?: string;
  createdAt: number;
}

export default function Servers() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [newServerDesc, setNewServerDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      setLoading(true);
      const data = await api('/api/servers');
      setServers(data.servers || []);
    } catch (e: any) {
      console.error('Failed to load servers:', e);
      showToast('Ошибка загрузки серверов: ' + e.message, 'error');
      setServers([]);
    } finally {
      setLoading(false);
    }
  };

  const createServer = async () => {
    if (!newServerName.trim()) {
      showToast('Введите название сервера', 'warning');
      return;
    }
    try {
      setCreating(true);
      await api('/api/servers', 'POST', {
        name: newServerName.trim(),
        description: newServerDesc.trim() || undefined
      });
      setNewServerName('');
      setNewServerDesc('');
      setShowCreate(false);
      showToast(`Сервер "${newServerName.trim()}" создан`, 'success');
      await loadServers();
    } catch (e: any) {
      showToast('Ошибка создания сервера: ' + e.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="empty" style={{padding: '48px'}}>Загрузка...</div>
      </div>
    );
  }

  return (
    <div style={{padding: '24px', maxWidth: 1200, margin: '0 auto'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
        <h2 style={{fontSize: '28px', fontWeight: '700'}}>Серверы</h2>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: '12px 24px',
            background: 'var(--accent, #3b82f6)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px'
          }}
        >
          + Создать сервер
        </button>
      </div>

      <Modal
        isOpen={showCreate}
        onClose={() => {
          setShowCreate(false);
          setNewServerName('');
          setNewServerDesc('');
        }}
        title="Создать сервер"
        size="medium"
      >
        <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
          <div>
            <label style={{display: 'block', marginBottom: '8px', fontWeight: '600'}}>
              Название сервера <span style={{color: '#ef4444'}}>*</span>
            </label>
            <input
              placeholder="Название вашего сервера"
              value={newServerName}
              onChange={e => setNewServerName(e.target.value)}
              maxLength={100}
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--panel-2, #111827)',
                border: '1px solid var(--border, #374151)',
                borderRadius: '8px',
                color: 'var(--fg, #e5e7eb)'
              }}
            />
          </div>
          <div>
            <label style={{display: 'block', marginBottom: '8px', fontWeight: '600'}}>
              Описание (необязательно)
            </label>
            <textarea
              placeholder="Краткое описание сервера"
              value={newServerDesc}
              onChange={e => setNewServerDesc(e.target.value)}
              maxLength={500}
              rows={4}
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--panel-2, #111827)',
                border: '1px solid var(--border, #374151)',
                borderRadius: '8px',
                color: 'var(--fg, #e5e7eb)',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>
          <div style={{display: 'flex', gap: '8px', justifyContent: 'flex-end'}}>
            <button
              onClick={() => {
                setShowCreate(false);
                setNewServerName('');
                setNewServerDesc('');
              }}
              style={{
                padding: '10px 20px',
                background: 'transparent',
                border: '1px solid var(--border, #374151)',
                borderRadius: '8px',
                color: 'var(--fg, #e5e7eb)',
                cursor: 'pointer'
              }}
            >
              Отмена
            </button>
            <button
              onClick={createServer}
              disabled={creating || !newServerName.trim()}
              style={{
                padding: '10px 20px',
                background: (creating || !newServerName.trim()) ? '#6b7280' : 'var(--accent, #3b82f6)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: (creating || !newServerName.trim()) ? 'not-allowed' : 'pointer',
                fontWeight: '600'
              }}
            >
              {creating ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </div>
      </Modal>

      {servers.length === 0 ? (
        <div style={{
          padding: '64px',
          background: 'var(--panel, rgba(31, 41, 55, 0.6))',
          border: '1px solid var(--border, #374151)',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <div className="empty">
            <div style={{fontSize: '64px', marginBottom: '16px'}}>🖥️</div>
            <div style={{fontSize: '20px', fontWeight: '600', marginBottom: '8px'}}>У вас пока нет серверов</div>
            <div className="small" style={{color: 'var(--subtle, #9ca3af)', marginBottom: '24px'}}>
              Создайте свой первый сервер для общения и совместной работы
            </div>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                padding: '12px 24px',
                background: 'var(--accent, #3b82f6)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '16px'
              }}
            >
              + Создать сервер
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '20px'
        }}>
          {servers.map(server => (
            <div
              key={server.id}
              onClick={() => navigate(`/app/servers/${server.id}`)}
              style={{
                padding: '24px',
                background: 'var(--panel, rgba(31, 41, 55, 0.6))',
                border: '1px solid var(--border, #374151)',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.3)';
                e.currentTarget.style.borderColor = 'var(--accent, #3b82f6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = 'var(--border, #374151)';
              }}
            >
              <div style={{
                fontSize: '48px',
                marginBottom: '16px',
                textAlign: 'center'
              }}>
                {server.iconUrl ? (
                  <img src={server.iconUrl} alt={server.name} style={{width: '64px', height: '64px', borderRadius: '12px'}} />
                ) : (
                  '🖥️'
                )}
              </div>
              <div style={{
                fontSize: '20px',
                fontWeight: '600',
                marginBottom: '8px',
                textAlign: 'center'
              }}>
                {server.name}
              </div>
              {server.description && (
                <div className="small" style={{
                  color: 'var(--subtle, #9ca3af)',
                  marginBottom: '12px',
                  textAlign: 'center',
                  lineHeight: '1.5'
                }}>
                  {server.description}
                </div>
              )}
              <div className="small" style={{
                color: 'var(--subtle, #9ca3af)',
                textAlign: 'center'
              }}>
                Создан: {new Date(server.createdAt).toLocaleDateString('ru-RU')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
