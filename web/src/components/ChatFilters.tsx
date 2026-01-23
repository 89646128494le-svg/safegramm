import React from 'react';

export type ChatFilter = 'all' | 'unread' | 'groups' | 'channels' | 'starred';

interface ChatFiltersProps {
  activeFilter: ChatFilter;
  onFilterChange: (filter: ChatFilter) => void;
  unreadCount?: number;
  starredCount?: number;
}

export default function ChatFilters({
  activeFilter,
  onFilterChange,
  unreadCount = 0,
  starredCount = 0,
}: ChatFiltersProps) {
  const filters: Array<{ id: ChatFilter; label: string; icon: string; count?: number }> = [
    { id: 'all', label: 'Все', icon: '💬' },
    { id: 'unread', label: 'Непрочитанные', icon: '🔔', count: unreadCount },
    { id: 'groups', label: 'Группы', icon: '👥' },
    { id: 'channels', label: 'Каналы', icon: '📢' },
    { id: 'starred', label: 'Закладки', icon: '⭐', count: starredCount },
  ];

  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      padding: '12px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-secondary)',
      overflowX: 'auto',
      flexWrap: 'nowrap'
    }}>
      {filters.map((filter) => (
        <button
          key={filter.id}
          onClick={() => onFilterChange(filter.id)}
          style={{
            padding: '8px 16px',
            background: activeFilter === filter.id ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
            border: `1px solid ${activeFilter === filter.id ? 'var(--accent-primary)' : 'var(--border)'}`,
            borderRadius: '20px',
            color: activeFilter === filter.id ? 'white' : 'var(--text-primary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            fontSize: '13px',
            fontWeight: activeFilter === filter.id ? '600' : '400',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            if (activeFilter !== filter.id) {
              e.currentTarget.style.background = 'var(--bg-card)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeFilter !== filter.id) {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
            }
          }}
        >
          <span>{filter.icon}</span>
          <span>{filter.label}</span>
          {filter.count !== undefined && filter.count > 0 && (
            <span style={{
              background: activeFilter === filter.id ? 'rgba(255,255,255,0.3)' : 'var(--accent-primary)',
              color: 'white',
              borderRadius: '10px',
              padding: '2px 6px',
              fontSize: '11px',
              fontWeight: 'bold',
              marginLeft: '4px'
            }}>
              {filter.count > 99 ? '99+' : filter.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
