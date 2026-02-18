/**
 * Contacts — контакты из той же БД (API: /api/contacts/list, search, add, remove).
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../core/api/client';
import './Contacts.css';

interface ContactsProps {
  wsManager: any;
  user: any;
}

interface User {
  id: string;
  username: string;
  avatarUrl?: string;
  status?: string;
}

export default function Contacts(_props: ContactsProps) {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  async function loadContacts() {
    try {
      setLoading(true);
      const r = await apiClient.get<{ contacts?: User[] }>('/api/contacts/list');
      setContacts(Array.isArray(r) ? r : (r?.contacts || []));
    } catch (e: any) {
      if (e?.status === 404) setContacts([]);
      else console.error('Failed to load contacts:', e);
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }

  async function search() {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      setSearching(true);
      const r = await apiClient.get<{ users?: User[] }>(
        '/api/contacts/search?q=' + encodeURIComponent(searchQuery.trim())
      );
      setSearchResults(Array.isArray(r) ? r : (r?.users || []));
    } catch (e: any) {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function addContact(userId: string, username: string) {
    try {
      await apiClient.post('/api/contacts/add', { userId });
      alert(`Пользователь ${username} добавлен в контакты`);
      loadContacts();
      setSearchResults(prev => prev.filter(u => u.id !== userId));
    } catch (e: any) {
      alert('Ошибка: ' + (e.message || ''));
    }
  }

  async function removeContact(userId: string, username: string) {
    if (!confirm(`Удалить ${username} из контактов?`)) return;
    try {
      await apiClient.post('/api/contacts/remove', { userId });
      loadContacts();
    } catch (e: any) {
      alert('Ошибка: ' + (e.message || ''));
    }
  }

  async function createDM(userId: string) {
    try {
      const response = await apiClient.post<{ id: string }>('/api/chats', {
        type: 'dm',
        memberIds: [userId]
      });
      const chatId = response?.id;
      if (chatId) navigate('/chats?chatId=' + chatId);
      else alert('Чат создан!');
    } catch (error: any) {
      alert('Ошибка создания чата: ' + (error.message || ''));
    }
  }

  if (loading) {
    return (
      <div className="contacts-page-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="contacts-page">
      <h2>👥 Контакты</h2>

      <div className="contacts-search">
        <input
          type="text"
          placeholder="Поиск пользователей для добавления..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          className="search-input"
        />
        <button type="button" className="btn btn-sm btn-primary" onClick={search} disabled={searching}>
          {searching ? 'Поиск...' : 'Искать'}
        </button>
      </div>

      {searchResults.length > 0 && (
        <div className="contacts-section">
          <h3>Результаты поиска</h3>
          {searchResults.map(u => (
            <div key={u.id} className="contact-item">
              <div className="contact-avatar">
                {u.avatarUrl ? (
                  <img src={u.avatarUrl} alt={u.username} />
                ) : (
                  <div className="contact-avatar-placeholder">
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="contact-info">
                <div className="contact-name">{u.username}</div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => addContact(u.id, u.username)}
              >
                Добавить
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => createDM(u.id)}
              >
                Написать
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="contacts-section">
        <h3>Мои контакты</h3>
        <div className="contacts-list">
          {contacts.length === 0 ? (
            <div className="contacts-empty">
              <p>Нет контактов. Найдите пользователей выше и нажмите «Добавить».</p>
            </div>
          ) : (
            contacts.map(contact => (
              <div key={contact.id} className="contact-item">
                <div className="contact-avatar">
                  {contact.avatarUrl ? (
                    <img src={contact.avatarUrl} alt={contact.username} />
                  ) : (
                    <div className="contact-avatar-placeholder">
                      {contact.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="contact-info">
                  <div className="contact-name">{contact.username}</div>
                  {contact.status && (
                    <div className={`contact-status status-${contact.status}`}>{contact.status}</div>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => createDM(contact.id)}
                >
                  Написать
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => removeContact(contact.id, contact.username)}
                >
                  Удалить
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
