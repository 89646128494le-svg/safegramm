import React, { useRef, useState } from 'react';
import { useSwipeActions } from '../utils/swipeGestures';

interface ChatListItemProps {
  chat: {
    id: string;
    type: 'dm' | 'group' | 'channel';
    name?: string;
    members: string[];
    lastMessage?: any;
    unreadCount?: number;
    isStarred?: boolean;
  };
  isSelected: boolean;
  onClick: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onStar?: () => void;
  onUnstar?: () => void;
  getChatName: (chat: any) => string;
  getChatPreview: (chat: any) => string;
}

export default function ChatListItem({
  chat,
  isSelected,
  onClick,
  onArchive,
  onDelete,
  onStar,
  onUnstar,
  getChatName,
  getChatPreview,
}: ChatListItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  // Swipe жесты
  useSwipeActions(itemRef, {
    onSwipeLeft: () => {
      if (onArchive) {
        onArchive();
      }
    },
    onSwipeRight: () => {
      if (onStar) {
        if (chat.isStarred) {
          onUnstar?.();
        } else {
          onStar();
        }
      }
    },
  });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    // Можно добавить контекстное меню
  };

  return (
    <div
      ref={itemRef}
      data-chat-item={chat.id}
      className={`list-item chat-list-item ${isSelected ? 'active' : ''} ${chat.isStarred ? 'starred' : ''}`}
      onClick={onClick}
      onContextMenu={handleContextMenu}
      style={{
        cursor: 'pointer',
        position: 'relative',
        transform: `translateX(${swipeOffset}px)`,
        transition: swipeOffset === 0 ? 'transform 0.3s ease-out' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', width: '100%' }}>
        {/* Иконка типа чата */}
        <div style={{ fontSize: '20px', flexShrink: 0 }}>
          {chat.type === 'dm' ? '💬' : chat.type === 'group' ? '👥' : '📢'}
        </div>

        {/* Закладка */}
        {chat.isStarred && (
          <div style={{ fontSize: '14px', color: '#fbbf24', flexShrink: 0 }}>⭐</div>
        )}

        {/* Информация о чате */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ 
            fontWeight: isSelected ? 'bold' : 'normal',
            fontSize: '14px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            {getChatName(chat)}
            {chat.unreadCount && chat.unreadCount > 0 && (
              <span style={{
                background: 'var(--accent-primary)',
                color: 'white',
                borderRadius: '10px',
                padding: '2px 6px',
                fontSize: '11px',
                fontWeight: 'bold',
                marginLeft: 'auto'
              }}>
                {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
              </span>
            )}
          </div>
          {chat.lastMessage && (
            <div className="small" style={{ 
              marginTop: '4px', 
              opacity: 0.7,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {getChatPreview(chat)}
            </div>
          )}
        </div>
      </div>

      {/* Действия при свайпе */}
      <div style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '0 12px',
        background: 'var(--bg-secondary)',
        opacity: Math.abs(swipeOffset) > 20 ? 1 : 0,
        transition: 'opacity 0.2s',
        pointerEvents: swipeOffset < -20 ? 'auto' : 'none',
      }}>
        {onArchive && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onArchive();
            }}
            style={{
              background: 'var(--warning)',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 12px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            📦
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{
              background: 'var(--danger)',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 12px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
}
