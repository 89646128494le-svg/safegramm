import React, { useMemo, useRef, useEffect, useState } from 'react';
import { VariableSizeList as List } from 'react-window';
import { motion, AnimatePresence } from 'framer-motion';
import { setupLazyImage } from '../utils/lazyMediaLoader';
import { loadAndCacheImage } from '../utils/imageCache';
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
  const [itemHeights, setItemHeights] = useState<Map<number, number>>(new Map());

  // Прокрутка вниз при новых сообщениях
  useEffect(() => {
    if (listRef.current && messages.length > 0) {
      listRef.current.scrollToItem(messages.length - 1, 'end');
    }
  }, [messages.length]);

  // Оценка высоты каждого сообщения (динамическая)
  const getItemSize = (index: number) => {
    // Используем сохраненную высоту, если есть
    if (itemHeights.has(index)) {
      return itemHeights.get(index)!;
    }

    const msg = messages[index];
    if (!msg) return 60;

    let height = 60; // базовая высота

    if (msg.replyTo) height += 60;
    if (msg.forwardFrom) height += 40;
    if (msg.threadId) height += 30;
    if (msg.text && msg.text.length > 100) height += Math.floor(msg.text.length / 50) * 20;
    if (msg.attachmentUrl) height += 200;
    if (reactions.get(msg.id)?.length) height += 40;

    return height;
  };

  // Обновление высоты элемента после рендера
  const updateItemSize = (index: number, height: number) => {
    if (itemHeights.get(index) !== height) {
      setItemHeights(prev => {
        const newMap = new Map(prev);
        newMap.set(index, height);
        return newMap;
      });
      if (listRef.current) {
        listRef.current.resetAfterIndex(index);
      }
    }
  };

  // Компонент для ленивой загрузки изображений
  const LazyImageComponent = ({ src, alt, className, onLoad }: { 
    src: string; 
    alt: string; 
    className?: string;
    onLoad?: (height: number) => void;
  }) => {
    const imgRef = useRef<HTMLImageElement>(null);
    const [imageSrc, setImageSrc] = useState<string | null>(null);

    useEffect(() => {
      if (!imgRef.current) return;

      // Настраиваем ленивую загрузку
      const cleanup = setupLazyImage(imgRef.current, src, {
        rootMargin: '100px'
      });

      // Загружаем и кэшируем изображение
      loadAndCacheImage(src)
        .then(blob => {
          const url = URL.createObjectURL(blob);
          setImageSrc(url);
          if (imgRef.current && onLoad) {
            imgRef.current.onload = () => {
              onLoad(imgRef.current?.offsetHeight || 200);
            };
          }
        })
        .catch(() => {
          setImageSrc(src); // Fallback на оригинальный URL
        });

      return cleanup;
    }, [src, onLoad]);

    return (
      <img
        ref={imgRef}
        src={imageSrc || undefined}
        alt={alt}
        className={className}
        loading="lazy"
        style={{ opacity: imageSrc ? 1 : 0, transition: 'opacity 0.3s' }}
      />
    );
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
                <LazyImageComponent
                  src={sender.avatarUrl}
                  alt={sender.username}
                  className="avatar-img"
                />
              ) : (
                <div className="avatar-placeholder">{sender?.username?.[0]?.toUpperCase() || 'U'}</div>
              )}
            </motion.div>
          )}
          <div className="message-content">
            {!isMe && showAvatar && (
              <div className="message-sender">{sender?.username || 'Пользователь'}</div>
            )}
            {msg.text && (
              <div className="message-text">{msg.text}</div>
            )}
            {msg.attachmentUrl && (
              <LazyImageComponent
                src={msg.attachmentUrl}
                alt="attachment"
                className="message-attachment"
                onLoad={(height) => updateItemSize(index, height)}
              />
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
      itemSize={getItemSize}
      width="100%"
      style={{ direction: 'rtl' }}
      onScroll={(props) => {
        // Можно добавить логику загрузки старых сообщений при прокрутке вверх
        if (props.scrollOffset < 100 && props.scrollDirection === 'backward') {
          // Загружаем старые сообщения
        }
      }}
      estimatedItemSize={100} // Примерная высота для оптимизации
    >
      {Row}
    </List>
  );
}
