import React, { useRef, useState } from 'react';
import { useSwipeActions } from '../utils/swipeGestures';
import { UsernameWithRole } from './RoleBadge';

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
  getChatUser?: (chat: any) => { id?: string; username?: string; roles?: string[] | string } | null;
  hidePreview?: boolean;
  density?: 'comfortable' | 'compact';
}

function getChatTypeBadge(type: ChatListItemProps['chat']['type']): string {
  if (type === 'dm') return 'DM';
  if (type === 'group') return 'GRP';
  return 'CH';
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
  getChatUser,
  hidePreview = false,
  density = 'comfortable',
}: ChatListItemProps) {
  const displayUser = getChatUser?.(chat);
  const nameNode = displayUser ? (
    <UsernameWithRole user={displayUser} username={getChatName(chat)} showBadge showColor />
  ) : (
    getChatName(chat)
  );

  const itemRef = useRef<HTMLDivElement>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [swipeOffset] = useState(0);

  useSwipeActions(itemRef, {
    onSwipeLeft: () => {
      if (onArchive) onArchive();
    },
    onSwipeRight: () => {
      if (!onStar && !onUnstar) return;
      if (chat.isStarred) onUnstar?.();
      else onStar?.();
    },
  });

  const compact = density === 'compact';
  const showActionsToggle = Boolean(onArchive || onDelete || onStar || onUnstar);

  return (
    <div
      ref={itemRef}
      data-chat-item={chat.id}
      className={`list-item chat-list-item ${isSelected ? 'active' : ''} ${chat.isStarred ? 'starred' : ''}`}
      onClick={() => {
        setActionsOpen(false);
        onClick();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setActionsOpen(true);
      }}
      style={{
        cursor: 'pointer',
        position: 'relative',
        transform: `translateX(${swipeOffset}px)`,
        transition: 'transform 0.2s ease-out',
        padding: compact ? '10px 12px' : '12px 14px',
        touchAction: 'pan-y',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
        <div
          style={{
            minWidth: compact ? 34 : 38,
            height: compact ? 34 : 38,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(13, 23, 39, 0.9)',
            border: '1px solid rgba(111, 194, 255, 0.16)',
            color: '#dff0ff',
            fontSize: compact ? '11px' : '12px',
            fontWeight: 800,
            letterSpacing: 0.4,
            flexShrink: 0,
          }}
        >
          {getChatTypeBadge(chat.type)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: isSelected ? 800 : 700,
              fontSize: compact ? '13px' : '14px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameNode}</span>
            {chat.isStarred ? (
              <span style={{ color: '#f7d05b', fontSize: '11px', fontWeight: 800, flexShrink: 0 }}>STAR</span>
            ) : null}
            {chat.unreadCount && chat.unreadCount > 0 ? (
              <span
                style={{
                  marginLeft: 'auto',
                  background: 'var(--accent-primary)',
                  color: '#ffffff',
                  borderRadius: '999px',
                  padding: '2px 7px',
                  fontSize: '11px',
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
              </span>
            ) : null}
          </div>
          {chat.lastMessage ? (
            <div
              className="small"
              style={{
                marginTop: compact ? '2px' : '4px',
                opacity: 0.72,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {hidePreview ? 'Preview hidden' : getChatPreview(chat)}
            </div>
          ) : null}
        </div>

        {showActionsToggle ? (
          <button
            type="button"
            className="chat-item-actions-toggle"
            onClick={(e) => {
              e.stopPropagation();
              setActionsOpen((prev) => !prev);
            }}
            style={{
              minWidth: 44,
              minHeight: 44,
              padding: '0 12px',
              borderRadius: 12,
              border: '1px solid rgba(111, 194, 255, 0.14)',
              background: actionsOpen ? 'rgba(20, 42, 69, 0.94)' : 'rgba(8, 16, 28, 0.74)',
              color: '#dff0ff',
              fontSize: '12px',
              fontWeight: 800,
              flexShrink: 0,
              cursor: 'pointer',
            }}
          >
            Menu
          </button>
        ) : null}
      </div>

      {actionsOpen ? (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            marginTop: compact ? 8 : 10,
            paddingTop: compact ? 8 : 10,
            borderTop: '1px solid rgba(109, 136, 168, 0.14)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {onArchive ? (
            <button
              type="button"
              onClick={() => {
                setActionsOpen(false);
                onArchive();
              }}
              style={{
                minHeight: 40,
                padding: '0 12px',
                borderRadius: 12,
                border: '1px solid rgba(247, 195, 107, 0.22)',
                background: 'rgba(83, 54, 10, 0.76)',
                color: '#fff2d7',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Archive
            </button>
          ) : null}
          {onStar || onUnstar ? (
            <button
              type="button"
              onClick={() => {
                setActionsOpen(false);
                if (chat.isStarred) onUnstar?.();
                else onStar?.();
              }}
              style={{
                minHeight: 40,
                padding: '0 12px',
                borderRadius: 12,
                border: '1px solid rgba(111, 194, 255, 0.18)',
                background: chat.isStarred ? 'rgba(70, 59, 15, 0.82)' : 'rgba(11, 19, 31, 0.74)',
                color: chat.isStarred ? '#fff0b8' : '#dff0ff',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {chat.isStarred ? 'Unstar' : 'Star'}
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={() => {
                setActionsOpen(false);
                onDelete();
              }}
              style={{
                minHeight: 40,
                padding: '0 12px',
                borderRadius: 12,
                border: '1px solid rgba(233, 114, 114, 0.22)',
                background: 'rgba(83, 21, 21, 0.84)',
                color: '#ffe1e1',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Delete chat
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
