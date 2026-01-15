
import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

interface User {
  id: string;
  username: string;
  avatarUrl?: string;
}

interface MentionAutocompleteProps {
  text: string;
  cursorPosition: number;
  onSelect: (username: string) => void;
  onClose: () => void;
  chatMembers?: string[];
}

export default function MentionAutocomplete({ 
  text, 
  cursorPosition, 
  onSelect, 
  onClose,
  chatMembers 
}: MentionAutocompleteProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Находим упоминание перед курсором (улучшенный regex)
    const textBeforeCursor = text.slice(0, cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@([\w.-]*)$/);
    
    if (!mentionMatch) {
      onClose();
      return;
    }

    const query = mentionMatch[1].toLowerCase();
    
    // Если это начало упоминания без текста, показываем всех пользователей чата
    if (chatMembers && query === '') {
      loadChatMembers();
      return;
    }

    // Иначе ищем пользователей по запросу
    searchUsers(query);
  }, [text, cursorPosition]);

  const loadChatMembers = async () => {
    try {
      if (!chatMembers) return;
      const allUsers = await api('/api/users');
      const memberUsers = allUsers.users?.filter((u: User) => chatMembers.includes(u.id)) || [];
      setUsers(memberUsers.slice(0, 10));
    } catch (e) {
      console.error('Failed to load chat members:', e);
    }
  };

  const searchUsers = async (query: string) => {
    try {
      const data = await api('/api/users/search?q=' + encodeURIComponent(query));
      const filtered = chatMembers 
        ? data.users?.filter((u: User) => chatMembers.includes(u.id)) || []
        : data.users || [];
      setUsers(filtered.slice(0, 10));
    } catch (e) {
      console.error('Failed to search users:', e);
      setUsers([]);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (users.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % users.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + users.length) % users.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (users[selectedIndex]) {
          onSelect(users[selectedIndex].username);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [users, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const item = listRef.current.children[selectedIndex] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  if (users.length === 0) return null;

  return (
    <div className="mention-autocomplete" ref={listRef}>
      {users.map((user, index) => (
        <div
          key={user.id}
          className={`mention-item ${index === selectedIndex ? 'selected' : ''}`}
          onClick={() => onSelect(user.username)}
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.username} className="mention-avatar" />
          ) : (
            <div className="mention-avatar-placeholder">
              {user.username[0].toUpperCase()}
            </div>
          )}
          <span className="mention-username">@{user.username}</span>
        </div>
      ))}
    </div>
  );
}




