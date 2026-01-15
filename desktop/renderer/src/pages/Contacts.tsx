/**
 * Contacts Page - Страница контактов
 */

import React, { useEffect, useState } from 'react';
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
  about?: string;
}

export default function Contacts({ wsManager, user }: ContactsProps) {
  const [contacts, setContacts] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadContacts();
  }, []);

  async function loadContacts() {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/users');
      setContacts(response.users || []);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createDM(userId: string) {
    try {
      const response = await apiClient.post('/api/chats', {
        type: 'dm',
        memberIds: [userId]
      });
      // TODO: Navigate to chat
      alert('Чат создан!');
    } catch (error: any) {
      alert('Ошибка создания чата: ' + error.message);
    }
  }

  const filteredContacts = contacts.filter(contact =>
    contact.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          placeholder="Поиск контактов..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="contacts-list">
        {filteredContacts.length === 0 ? (
          <div className="contacts-empty">
            <p>Нет контактов</p>
          </div>
        ) : (
          filteredContacts.map(contact => (
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
                {contact.about && (
                  <div className="contact-bio">{contact.about}</div>
                )}
                {contact.status && (
                  <div className={`contact-status status-${contact.status}`}>
                    {contact.status}
                  </div>
                )}
              </div>
              <button
                onClick={() => createDM(contact.id)}
                className="btn btn-sm btn-primary"
              >
                Написать
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
