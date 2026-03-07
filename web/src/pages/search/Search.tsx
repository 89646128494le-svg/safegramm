
import React, { useState } from 'react';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../../components/Toast';

export default function Search() {
  const [q, setQ] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'messages' | 'chats' | 'users'>('all');
  const [results, setResults] = useState<{
    messages?: any[];
    chats?: any[];
    users?: any[];
  }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const run = async () => {
    if (!q.trim() || q.trim().length < 2) {
      setResults({});
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const typeParam = searchType === 'all' ? '' : `&type=${searchType}`;
      const r = await api(`/api/search?q=${encodeURIComponent(q)}${typeParam}`);
      setResults({
        messages: r.messages || [],
        chats: r.chats || [],
        users: r.users || [],
      });
    } catch (e: any) {
      console.error('Search error:', e);
      setError(e.message || 'Ошибка поиска');
      setResults({});
    } finally {
      setLoading(false);
    }
  };

  const totalResults = (results.messages?.length || 0) + (results.chats?.length || 0) + (results.users?.length || 0);

  return (
    <div style={{padding: 16, maxWidth: 1000, margin: '0 auto'}}>
      <h2 style={{marginBottom: '16px'}}>🔍 Поиск</h2>
      
      <div style={{marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
        <input 
          placeholder="Введите запрос для поиска..." 
          value={q} 
          onChange={e=>setQ(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && run()}
          style={{
            flex: 1,
            minWidth: '200px',
            padding: '10px 16px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            fontSize: '14px'
          }}
        />
        <select
          value={searchType}
          onChange={(e) => setSearchType(e.target.value as any)}
          style={{
            padding: '10px 16px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            fontSize: '14px'
          }}
        >
          <option value="all">Всё</option>
          <option value="messages">Сообщения</option>
          <option value="chats">Чаты</option>
          <option value="users">Пользователи</option>
        </select>
        <button 
          onClick={run} 
          disabled={loading || !q.trim() || q.trim().length < 2}
          style={{
            padding: '10px 20px',
            background: 'var(--accent-primary)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading || !q.trim() || q.trim().length < 2 ? 0.5 : 1
          }}
        >
          {loading ? 'Поиск...' : 'Искать'}
        </button>
      </div>

      {q.trim().length > 0 && q.trim().length < 2 && (
        <div style={{
          padding: '12px',
          background: 'rgba(251, 191, 36, 0.1)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: '8px',
          color: '#fbbf24',
          marginBottom: '16px'
        }}>
          Введите минимум 2 символа для поиска
        </div>
      )}

      {error && (
        <div style={{
          padding: 12,
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 8,
          color: '#fca5a5',
          marginBottom: 16
        }}>
          {error}
        </div>
      )}

      {totalResults === 0 && !loading && q.trim().length >= 2 && !error && (
        <div className="empty" style={{padding: 24, textAlign: 'center'}}>
          Ничего не найдено
        </div>
      )}

      {totalResults > 0 && (
        <div>
          <div style={{marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '14px'}}>
            Найдено результатов: {totalResults}
          </div>

          {/* Сообщения */}
          {results.messages && results.messages.length > 0 && (
            <div style={{marginBottom: '24px'}}>
              <h3 style={{marginBottom: '12px', fontSize: '18px'}}>💬 Сообщения ({results.messages.length})</h3>
              {results.messages.map(m => (
                <div 
                  key={m.id} 
                  className="list-item" 
                  style={{
                    marginBottom: '8px',
                    padding: '12px',
                    background: 'var(--bg-card)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    if (m.chatId) {
                      navigate(`/app/chats?chatId=${m.chatId}`);
                    }
                  }}
                >
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px'}}>
                    {m.sender && (
                      <span style={{fontWeight: '600', color: 'var(--text-primary)'}}>
                        {m.sender.username}
                      </span>
                    )}
                    {m.chat && (
                      <span style={{fontSize: '12px', color: 'var(--text-secondary)'}}>
                        в {m.chat.name || m.chat.type}
                      </span>
                    )}
                    <span style={{fontSize: '12px', color: 'var(--text-tertiary)', marginLeft: 'auto'}}>
                      {new Date(m.createdAt).toLocaleString('ru-RU')}
                    </span>
                  </div>
                  <div style={{color: 'var(--text-primary)'}}>
                    {m.text || 'Сообщение'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Чаты */}
          {results.chats && results.chats.length > 0 && (
            <div style={{marginBottom: '24px'}}>
              <h3 style={{marginBottom: '12px', fontSize: '18px'}}>💬 Чаты ({results.chats.length})</h3>
              {results.chats.map(chat => (
                <div 
                  key={chat.id} 
                  className="list-item" 
                  style={{
                    marginBottom: '8px',
                    padding: '12px',
                    background: 'var(--bg-card)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer'
                  }}
                  onClick={() => navigate(`/app/chats?chatId=${chat.id}`)}
                >
                  <div style={{fontWeight: '600', marginBottom: '4px'}}>
                    {chat.name || (chat.type === 'dm' ? 'Личный чат' : chat.type === 'group' ? 'Группа' : 'Канал')}
                  </div>
                  {chat.description && (
                    <div style={{fontSize: '13px', color: 'var(--text-secondary)'}}>
                      {chat.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Пользователи */}
          {results.users && results.users.length > 0 && (
            <div style={{marginBottom: '24px'}}>
              <h3 style={{marginBottom: '12px', fontSize: '18px'}}>👥 Пользователи ({results.users.length})</h3>
              {results.users.map(user => (
                <div 
                  key={user.id} 
                  className="list-item" 
                  style={{
                    marginBottom: '8px',
                    padding: '12px',
                    background: 'var(--bg-card)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                  onClick={() => navigate(`/app/profile?userId=${user.id}`)}
                >
                  {user.avatarUrl ? (
                    <img 
                      src={user.avatarUrl} 
                      alt={user.username}
                      style={{width: '40px', height: '40px', borderRadius: '50%'}}
                    />
                  ) : (
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'var(--accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 'bold'
                    }}>
                      {user.username[0].toUpperCase()}
                    </div>
                  )}
                  <div style={{flex: 1}}>
                    <div style={{fontWeight: '600'}}>
                      {user.username}
                      {user.plan === 'premium' && <span style={{marginLeft: '8px', color: '#f59e0b'}}>⭐</span>}
                    </div>
                    <div style={{fontSize: '12px', color: 'var(--text-secondary)'}}>
                      {user.status === 'online' ? '🟢 В сети' : '⚪ Не в сети'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
