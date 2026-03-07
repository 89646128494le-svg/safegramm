
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { showToast } from '../../components/Toast';

export default function Contacts() {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(true);

  const search = async () => {
    if (!q.trim()) {
      setRes([]);
      return;
    }
    try {
      setLoading(true);
      const r = await api('/api/contacts/search?q=' + encodeURIComponent(q.trim()));
      setRes(Array.isArray(r) ? r : (r.users || []));
    } catch (e: any) {
      showToast('Ошибка поиска: ' + e.message, 'error');
      setRes([]);
    } finally {
      setLoading(false);
    }
  };

  const add = async (id: string, username: string) => {
    try {
      await api('/api/contacts/add', 'POST', { userId: id });
      showToast(`Пользователь ${username} добавлен в контакты`, 'success');
      loadContacts();
      setRes(res.filter(u => u.id !== id));
    } catch (e: any) {
      showToast('Ошибка: ' + e.message, 'error');
    }
  };

  const remove = async (id: string, username: string) => {
    try {
      await api('/api/contacts/remove', 'POST', { userId: id });
      showToast(`Пользователь ${username} удалён из контактов`, 'success');
      loadContacts();
    } catch (e: any) {
      showToast('Ошибка: ' + e.message, 'error');
    }
  };

  const loadContacts = async () => {
    try {
      setContactsLoading(true);
      const r = await api('/api/contacts/list');
      if (r === null) {
        // Эндпоинт не реализован
        setContacts([]);
        return;
      }
      setContacts(Array.isArray(r) ? r : (r?.contacts || []));
    } catch (e: any) {
      // Игнорируем 404 - эндпоинт еще не реализован
      if (e.status === 404 || e.errorCode === 'not_found') {
        setContacts([]);
        return;
      }
      showToast('Ошибка загрузки контактов: ' + e.message, 'error');
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  return (
    <div style={{padding: '24px', maxWidth: 1000, margin: '0 auto'}}>
      <h2 style={{marginBottom: '24px', fontSize: '28px', fontWeight: '700'}}>Контакты</h2>
      
      <div style={{
        padding: '24px',
        background: 'var(--panel, rgba(31, 41, 55, 0.6))',
        border: '1px solid var(--border, #374151)',
        borderRadius: '12px',
        marginBottom: '24px'
      }}>
        <h3 style={{marginBottom: '16px', fontSize: '20px', fontWeight: '600'}}>Поиск пользователей</h3>
        <div className="row" style={{marginBottom: '16px'}}>
          <input 
            placeholder="Введите имя пользователя для поиска..."
            value={q} 
            onChange={e=>setQ(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && search()}
            style={{
              flex: 1,
              padding: '12px',
              background: 'var(--panel-2, #111827)',
              border: '1px solid var(--border, #374151)',
              borderRadius: '8px',
              color: 'var(--fg, #e5e7eb)'
            }}
          />
          <button 
            onClick={search}
            disabled={loading || !q.trim()}
            style={{
              padding: '12px 24px',
              background: (loading || !q.trim()) ? '#6b7280' : 'var(--accent, #3b82f6)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: (loading || !q.trim()) ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              whiteSpace: 'nowrap'
            }}
          >
            {loading ? 'Поиск...' : '🔍 Искать'}
          </button>
        </div>
        
        {res.length > 0 && (
          <div>
            <div className="small" style={{marginBottom: '12px', color: 'var(--subtle, #9ca3af)'}}>
              Найдено: {res.length}
            </div>
            <div style={{display: 'grid', gap: '8px'}}>
              {res.map(u => {
                const isContact = contacts.some(c => c.id === u.id);
                return (
                  <div 
                    key={u.id}
                    style={{
                      padding: '12px',
                      background: 'var(--panel-2, #111827)',
                      border: '1px solid var(--border, #374151)',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{fontWeight: '600'}}>{u.username}</div>
                      {u.status && (
                        <div className="small" style={{color: 'var(--subtle, #9ca3af)'}}>
                          Статус: {u.status === 'online' ? '🟢 В сети' : '⚪ Не в сети'}
                        </div>
                      )}
                    </div>
                    {isContact ? (
                      <div className="small" style={{color: 'var(--subtle, #9ca3af)'}}>
                        Уже в контактах
                      </div>
                    ) : (
                      <button
                        onClick={() => add(u.id, u.username)}
                        style={{
                          padding: '8px 16px',
                          background: '#22c55e',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '500'
                        }}
                      >
                        + Добавить
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {res.length === 0 && q.trim() && !loading && (
          <div className="empty" style={{padding: '24px'}}>
            Ничего не найдено
          </div>
        )}
      </div>

      <div style={{
        padding: '24px',
        background: 'var(--panel, rgba(31, 41, 55, 0.6))',
        border: '1px solid var(--border, #374151)',
        borderRadius: '12px'
      }}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
          <h3 style={{fontSize: '20px', fontWeight: '600'}}>Мои контакты</h3>
          <div className="small" style={{color: 'var(--subtle, #9ca3af)'}}>
            Всего: {contacts.length}
          </div>
        </div>
        
        {contactsLoading ? (
          <div className="empty" style={{padding: '24px'}}>
            Загрузка...
          </div>
        ) : contacts.length === 0 ? (
          <div className="empty" style={{padding: '24px'}}>
            У вас пока нет контактов. Найдите пользователей и добавьте их в контакты.
          </div>
        ) : (
          <div style={{display: 'grid', gap: '8px'}}>
            {contacts.map(u => (
              <div 
                key={u.id}
                style={{
                  padding: '12px',
                  background: 'var(--panel-2, #111827)',
                  border: '1px solid var(--border, #374151)',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{fontWeight: '600'}}>{u.username}</div>
                  {u.status && (
                    <div className="small" style={{color: 'var(--subtle, #9ca3af)'}}>
                      Статус: {u.status === 'online' ? '🟢 В сети' : '⚪ Не в сети'}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => remove(u.id, u.username)}
                  style={{
                    padding: '8px 16px',
                    background: '#dc3545',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
