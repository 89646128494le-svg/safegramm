/**
 * Search Page - Страница поиска
 */

import { useState } from 'react';
import { apiClient } from '../core/api/client';
import { useNavigate } from 'react-router-dom';
import './Search.css';

interface SearchProps {
  wsManager: any;
  user: any;
}

export default function Search(_props: SearchProps) {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'messages' | 'chats' | 'users'>('all');
  const [results, setResults] = useState<{
    messages?: any[];
    chats?: any[];
    users?: any[];
  }>({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function runSearch() {
    if (!query.trim() || query.trim().length < 2) {
      setResults({});
      return;
    }

    setLoading(true);
    try {
      const typeParam = searchType === 'all' ? '' : `&type=${searchType}`;
      const response = await apiClient.get(`/api/search?q=${encodeURIComponent(query)}${typeParam}`);
      setResults({
        messages: response.messages || [],
        chats: response.chats || [],
        users: response.users || [],
      });
    } catch (error: any) {
      console.error('Search error:', error);
      setResults({});
    } finally {
      setLoading(false);
    }
  }

  const totalResults = (results.messages?.length || 0) + (results.chats?.length || 0) + (results.users?.length || 0);

  return (
    <div className="search-page">
      <h2>🔍 Поиск</h2>
      
      <div className="search-bar">
        <input
          type="text"
          placeholder="Введите запрос для поиска..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && runSearch()}
          className="search-input"
        />
        <select
          value={searchType}
          onChange={(e) => setSearchType(e.target.value as any)}
          className="search-type-select"
        >
          <option value="all">Всё</option>
          <option value="messages">Сообщения</option>
          <option value="chats">Чаты</option>
          <option value="users">Пользователи</option>
        </select>
        <button
          onClick={runSearch}
          disabled={loading || !query.trim() || query.trim().length < 2}
          className="btn btn-primary"
        >
          {loading ? 'Поиск...' : 'Искать'}
        </button>
      </div>

      {totalResults > 0 && (
        <div className="search-results">
          {results.messages && results.messages.length > 0 && (
            <div className="search-section">
              <h3>Сообщения ({results.messages.length})</h3>
              {results.messages.map((msg: any) => (
                <div
                  key={msg.id}
                  className="search-result-item"
                  onClick={() => navigate(`/chats?chatId=${msg.chatId}&messageId=${msg.id}`)}
                >
                  <div className="result-text">{msg.text}</div>
                  <div className="result-meta">
                    {new Date(msg.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {results.chats && results.chats.length > 0 && (
            <div className="search-section">
              <h3>Чаты ({results.chats.length})</h3>
              {results.chats.map((chat: any) => (
                <div
                  key={chat.id}
                  className="search-result-item"
                  onClick={() => navigate(`/chats?chatId=${chat.id}`)}
                >
                  <div className="result-title">{chat.name || chat.title || `Chat ${chat.id.slice(0, 8)}`}</div>
                  <div className="result-meta">{chat.type}</div>
                </div>
              ))}
            </div>
          )}

          {results.users && results.users.length > 0 && (
            <div className="search-section">
              <h3>Пользователи ({results.users.length})</h3>
              {results.users.map((user: any) => (
                <div
                  key={user.id}
                  className="search-result-item"
                  onClick={() => navigate(`/profile?userId=${user.id}`)}
                >
                  <div className="result-title">{user.username}</div>
                  {user.about && <div className="result-text">{user.about}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && query.trim().length >= 2 && totalResults === 0 && (
        <div className="search-empty">
          <p>Ничего не найдено</p>
        </div>
      )}
    </div>
  );
}
