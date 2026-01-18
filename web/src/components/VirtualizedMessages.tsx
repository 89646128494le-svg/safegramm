import React, { useMemo, useRef, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import { motion, AnimatePresence } from 'framer-motion';
import type { Message } from './EnhancedChatWindow';

interface VirtualizedMessagesProps {
  messages: Message[];
  currentUser: { id: string };
  getUser: (userId: string) => any;
  reactions: Map<string, Array<{ userId: string; emoji: string }>>;
  onReactionClick: (messageId: string, emoji: string) => void;
  onReplyClick: (message: Message) => void;
  onForwardClick: (messageId: string) => void;
  onSaveClick: (messageId: string, isSaved: boolean) => void;
  onPinClick: (messageId: string, isPinned: boolean) => void;
  onEditClick: (message: Message) => void;
  onDeleteClick: (messageId: string, deleteForAll: boolean) => void;
  onThreadClick: (messageId: string) => void;
  onUserProfileClick: (userId: string) => void;
  formatTime: (timestamp: number) => string;
  chatType?: 'dm' | 'group' | 'channel';
  threads?: Array<{ id: string; name: string }>;
  pinnedMessages?: Message[];
  isMessageSaved?: (messageId: string) => boolean;
  containerHeight: number;
}

export default function VirtualizedMessages({
  messages,
  currentUser,
  getUser,
  reactions,
  onReactionClick,
  onReplyClick,
  onForwardClick,
  onSaveClick,
  onPinClick,
  onEditClick,
  onDeleteClick,
  onThreadClick,
  onUserProfileClick,
  formatTime,
  chatType = 'dm',
  threads = [],
  pinnedMessages = [],
  isMessageSaved = () => false,
  containerHeight
}: VirtualizedMessagesProps) {
  const listRef = useRef<List>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Прокрутка вниз при новых сообщениях
  useEffect(() => {
    if (messagesEndRef.current && listRef.current) {
      listRef.current.scrollToItem(messages.length - 1, 'end');
    }
  }, [messages.length]);

  // Оценка высоты каждого сообщения (динамическая)
  const getItemSize = (index: number) => {
    const msg = messages[index];
    let height = 60; // базовая высота

    if (msg.replyTo) height += 60;
    if (msg.forwardFrom) height += 40;
    if (msg.threadId) height += 30;
    if (msg.text && msg.text.length > 100) height += Math.floor(msg.text.length / 50) * 20;
    if (msg.attachmentUrl) height += 200;
    if (reactions.get(msg.id)?.length) height += 40;

    return height;
  };

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const msg = messages[index];
    if (!msg) return null;

    const sender = getUser(msg.senderId);
    const isMe = msg.senderId === currentUser.id;
    const msgReactions = reactions.get(msg.id) || [];
    const prevMsg = index > 0 ? messages[index - 1] : null;
    const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId;
    const saved = isMessageSaved(msg.id);
    const isPinned = pinnedMessages.some(p => p.id === msg.id);

    return (
      <motion.div
        style={style}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`message-wrapper message ${isMe ? 'message-me me' : ''}`}
      >
        <div style={{ padding: '8px 16px' }}>
          {!isMe && showAvatar && (
            <motion.div
              className="message-avatar"
              onClick={() => onUserProfileClick(msg.senderId)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              {sender?.avatarUrl ? (
                <img src={sender.avatarUrl} alt={sender.username} />
              ) : (
                <div className="avatar-placeholder">{sender?.username?.[0]?.toUpperCase() || 'U'}</div>
              )}
            </motion.div>
          )}
          <div className="message-content">
            {!isMe && showAvatar && (
              <div className="message-sender">{sender?.username || 'Unknown'}</div>
            )}
            {msg.text && (
              <div className="message-text">{msg.text}</div>
            )}
            {msg.attachmentUrl && (
              <img src={msg.attachmentUrl} alt="attachment" className="message-attachment" />
            )}
            <div className="message-meta">
              <span>{formatTime(msg.createdAt)}</span>
              {isMe && (
                <span className="read-status">
                  {msg.readReceipts && msg.readReceipts.length > 0 ? '✓✓' : '✓'}
                </span>
              )}
            </div>
            {msgReactions.length > 0 && (
              <div className="message-reactions">
                {Array.from(new Set(msgReactions.map(r => r.emoji))).map(emoji => (
                  <motion.button
                    key={emoji}
                    className="reaction-btn"
                    onClick={() => onReactionClick(msg.id, emoji)}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {emoji} {msgReactions.filter(r => r.emoji === emoji).length}
                  </motion.button>
                ))}
              </div>
            )}
            <div className="message-actions">
              <motion.button onClick={() => onReactionClick(msg.id, '👍')} whileHover={{ scale: 1.1 }}>👍</motion.button>
              <motion.button onClick={() => onReactionClick(msg.id, '❤️')} whileHover={{ scale: 1.1 }}>❤️</motion.button>
              <motion.button onClick={() => onReplyClick(msg)} whileHover={{ scale: 1.1 }}>Ответить</motion.button>
              {msg.senderId === currentUser.id && (
                <>
                  <motion.button onClick={() => onEditClick(msg)} whileHover={{ scale: 1.1 }}>✏️</motion.button>
                  <motion.button onClick={() => onDeleteClick(msg.id, true)} whileHover={{ scale: 1.1 }}>🗑️</motion.button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  if (messages.length === 0) {
    return (
      <div style={{ height: containerHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="empty-messages"
        >
          <p>Нет сообщений</p>
          <p style={{ fontSize: '14px', color: 'rgba(233, 236, 245, 0.6)' }}>Начните общение!</p>
        </motion.div>
      </div>
    );
  }

  return (
    <List
      ref={listRef}
      height={containerHeight}
      itemCount={messages.length}
      itemSize={getItemSize(0)}
      width="100%"
      style={{ direction: 'rtl' }}
      onScroll={(props) => {
        // Можно добавить логику загрузки старых сообщений
      }}
    >
      {Row}
    </List>
  );
}
