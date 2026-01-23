import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

interface SearchResult {
  type: 'chat' | 'message' | 'user';
  id: string;
  title: string;
  subtitle?: string;
  chatId?: string;
  chatType?: 'dm' | 'group' | 'channel';
}

interface GlobalChatSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectChat: (chatId: string) => void;
  onSelectMessage?: (chatId: string, messageId: string) => void;
}

export default function GlobalChatSearch({
  isOpen,
  onClose,
  onSelectChat,
  onSelectMessage,
}: GlobalChatSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const search = async () => {
      setLoading(true);
      try {
        // Поиск по чатам
        const chatsData = await api('/api/chats');
        const chatResults: SearchResult[] = (chatsData.chats || [])
          .filter((chat: any) => {
            const name = chat.name || '';
            const members = chat.members || [];
            return name.toLowerCase().includes(query.toLowerCase()) ||
                   members.some((m: any) => 
                     (typeof m === 'string' ? m : m.username || '').toLowerCase().includes(query.toLowerCase())
                   );
          })
          .slice(0, 5)
          .map((chat: any) => ({
            type: 'chat' as const,
            id: chat.id,
            title: chat.name || `Чат ${chat.id}`,
            subtitle: chat.type === 'dm' ? 'Личный чат' : chat.type === 'group' ? 'Группа' : 'Канал',
            chatId: chat.id,
            chatType: chat.type,
          }));

        // Поиск по сообщениям
        const messageResults: SearchResult[] = [];
        for (const chat of (chatsData.chats || []).slice(0, 10)) {
          try {
            const messagesData = await api(`/api/chats/${chat.id}/messages?limit=50`);
            const matchingMessages = (messagesData.messages || [])
              .filter((msg: any) => 
                msg.text && msg.text.toLowerCase().includes(query.toLowerCase())
              )
              .slice(0, 3)
              .map((msg: any) => ({
                type: 'message' as const,
                id: msg.id,
                title: msg.text.slice(0, 50) + (msg.text.length > 50 ? '...' : ''),
                subtitle: `В ${chat.name || 'чате'}`,
                chatId: chat.id,
                chatType: chat.type,
              }));
            messageResults.push(...matchingMessages);
          } catch (e) {
            // Игнорируем ошибки при поиске в отдельных чатах
          }
        }

        setResults([...chatResults, ...messageResults.slice(0, 10)]);
      } catch (e) {
        console.error('Search error:', e);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(search, 300);
    return () => clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        handleSelectResult(results[selectedIndex]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  useEffect(() => {
    if (resultsRef.current && selectedIndex >= 0) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  const handleSelectResult = (result: SearchResult) => {
    if (result.type === 'chat' || result.type === 'message') {
      onSelectChat(result.chatId || result.id);
      if (result.type === 'message' && onSelectMessage && result.chatId) {
        setTimeout(() => {
          onSelectMessage(result.chatId!, result.id);
        }, 100);
      }
    }
    onClose();
    setQuery('');
    setResults([]);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '100px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-primary)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          border: '1px solid var(--border)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Поисковая строка */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="🔍 Поиск по чатам и сообщениям..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            style={{
              width: '100%',
              padding: '12px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '14px'
            }}
          />
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Используйте ↑↓ для навигации, Enter для выбора, Esc для закрытия
          </div>
        </div>

        {/* Результаты */}
        <div
          ref={resultsRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px'
          }}
        >
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Поиск...
            </div>
          ) : results.length === 0 && query ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Ничего не найдено
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Начните вводить для поиска...
            </div>
          ) : (
            results.map((result, index) => (
              <div
                key={`${result.type}-${result.id}`}
                onClick={() => handleSelectResult(result)}
                style={{
                  padding: '12px',
                  background: selectedIndex === index ? 'var(--bg-tertiary)' : 'transparent',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: selectedIndex === index ? '1px solid var(--accent-primary)' : '1px solid transparent',
                  marginBottom: '4px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div style={{ 
                  fontWeight: '600', 
                  fontSize: '14px',
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {result.type === 'chat' ? '💬' : result.type === 'message' ? '📝' : '👤'}
                  {result.title}
                </div>
                {result.subtitle && (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {result.subtitle}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
