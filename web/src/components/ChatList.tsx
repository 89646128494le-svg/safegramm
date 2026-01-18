import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Plus, Users, Hash, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

interface Chat {
  id: string;
  type: 'dm' | 'group' | 'channel';
  name?: string;
  title?: string;
  members?: string[];
  memberId?: string;
  requiresReview?: boolean;
  approved?: boolean;
}

interface ChatListProps {
  onSelectChat?: (chatId: string) => void;
}

export default function ChatList({ onSelectChat }: ChatListProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [createTarget, setCreateTarget] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      setLoading(true);
      const data = await api('/api/chats');
      setChats(data.chats || data || []);
    } catch (e) {
      console.error('Failed to load chats:', e);
    } finally {
      setLoading(false);
    }
  };

  const createDM = async () => {
    if (!createTarget.trim()) return;
    try {
      const r = await api('/api/chats', 'POST', { type: 'dm', memberId: createTarget });
      setChats(prev => {
        const has = prev.find(c => c.id === r.id);
        return has ? prev : [r, ...prev];
      });
      setCreateTarget('');
      if (onSelectChat && r.id) {
        onSelectChat(r.id);
      }
    } catch (e: any) {
      console.error('Failed to create DM:', e);
      alert('Ошибка создания DM: ' + (e.message || 'Неизвестная ошибка'));
    }
  };

  const createChannel = async () => {
    const title = prompt('Название канала:');
    if (!title) return;
    const category = prompt('Категория (например: general, sales):');
    try {
      const r = await api('/api/chats', 'POST', { type: 'channel', title, category });
      setChats([r, ...chats]);
      if (onSelectChat && r.id) {
        onSelectChat(r.id);
      }
      if (r.requiresReview && !r.approved) {
        alert('Канал отправлен на модерацию (sales).');
      }
    } catch (e: any) {
      console.error('Failed to create channel:', e);
      alert('Ошибка создания канала: ' + (e.message || 'Неизвестная ошибка'));
    }
  };

  const getChatIcon = (type: Chat['type']) => {
    switch (type) {
      case 'dm':
        return <MessageCircle size={18} />;
      case 'group':
        return <Users size={18} />;
      case 'channel':
        return <Hash size={18} />;
      default:
        return <MessageCircle size={18} />;
    }
  };

  const getChatName = (chat: Chat) => {
    if (chat.name) return chat.name;
    if (chat.title) return chat.title;
    if (chat.type === 'dm') return 'Личный чат';
    if (chat.type === 'group') return 'Группа';
    if (chat.type === 'channel') return 'Канал';
    return '(без названия)';
  };

  return (
    <div className="chat-list-container">
      <div className="chat-list-header">
        <h2 className="chat-list-title">
          <MessageCircle size={24} />
          <span>Мои чаты</span>
        </h2>
        <motion.button
          className="chat-list-add-btn"
          onClick={() => {
            const type = prompt('Тип чата (dm/group/channel):');
            if (type === 'dm') {
              const memberId = prompt('ID пользователя:');
              if (memberId) {
                setCreateTarget(memberId);
                createDM();
              }
            } else if (type === 'channel') {
              createChannel();
            }
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <Plus size={20} />
        </motion.button>
      </div>

      <div className="chat-list-search">
        <input
          type="text"
          placeholder="Поиск чатов..."
          className="chat-list-search-input"
        />
      </div>

      <div className="chat-list-actions">
        <motion.button
          className="chat-action-btn"
          onClick={() => {
            const memberId = prompt('ID пользователя для DM:');
            if (memberId) {
              setCreateTarget(memberId);
              createDM();
            }
          }}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          <MessageCircle size={16} />
          <span>Личный чат</span>
        </motion.button>
        <motion.button
          className="chat-action-btn"
          onClick={createChannel}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          <Hash size={16} />
          <span>Канал</span>
        </motion.button>
      </div>

      <div className="chat-list-items">
        {loading ? (
          <div className="chat-list-loading">Загрузка...</div>
        ) : chats.length === 0 ? (
          <div className="chat-list-empty">
            <MessageCircle size={48} />
            <p>Нет чатов</p>
            <p className="chat-list-empty-subtitle">Создайте новый чат для начала общения</p>
          </div>
        ) : (
          <AnimatePresence>
            {chats.map((chat, idx) => (
              <motion.div
                key={chat.id}
                className="chat-list-item"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ 
                  delay: idx * 0.05,
                  type: "spring",
                  stiffness: 300,
                  damping: 30
                }}
                onClick={() => onSelectChat?.(chat.id)}
                whileHover={{ 
                  scale: 1.02,
                  x: 4,
                  transition: { type: "spring", stiffness: 400, damping: 17 }
                }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="chat-list-item-icon">
                  {getChatIcon(chat.type)}
                </div>
                <div className="chat-list-item-content">
                  <div className="chat-list-item-header">
                    <span className="chat-list-item-type">{chat.type.toUpperCase()}</span>
                    {chat.type === 'channel' && chat.requiresReview && !chat.approved && (
                      <motion.div
                        className="chat-list-item-badge"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                      >
                        <AlertCircle size={12} />
                        <span>На модерации</span>
                      </motion.div>
                    )}
                  </div>
                  <div className="chat-list-item-name">{getChatName(chat)}</div>
                  <div className="chat-list-item-id">id: {chat.id}</div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

        <style>{`
        .chat-list-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: rgba(11, 16, 32, 0.65);
          backdrop-filter: blur(10px);
          border-right: 1px solid rgba(255, 255, 255, 0.1);
        }

        .chat-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .chat-list-title {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 24px;
          font-weight: 800;
          color: #e9ecf5;
          margin: 0;
        }

        .chat-list-add-btn {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(124, 108, 255, 0.3), rgba(61, 216, 255, 0.3));
          border: 1px solid rgba(124, 108, 255, 0.5);
          color: #7c6cff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .chat-list-add-btn:hover {
          background: linear-gradient(135deg, rgba(124, 108, 255, 0.4), rgba(61, 216, 255, 0.4));
          box-shadow: 0 4px 12px rgba(124, 108, 255, 0.3);
        }

        .chat-list-search {
          padding: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .chat-list-search-input {
          width: 100%;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: #e9ecf5;
          font-size: 14px;
          outline: none;
          transition: all 0.2s;
        }

        .chat-list-search-input:focus {
          border-color: rgba(124, 108, 255, 0.5);
          background: rgba(255, 255, 255, 0.08);
          box-shadow: 0 0 0 3px rgba(124, 108, 255, 0.1);
        }

        .chat-list-actions {
          display: flex;
          gap: 8px;
          padding: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .chat-action-btn {
          flex: 1;
          padding: 10px 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #e9ecf5;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .chat-action-btn:hover {
          background: rgba(124, 108, 255, 0.2);
          border-color: rgba(124, 108, 255, 0.4);
          color: #7c6cff;
        }

        .chat-list-items {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .chat-list-loading,
        .chat-list-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
          color: rgba(233, 236, 245, 0.6);
        }

        .chat-list-empty-subtitle {
          font-size: 14px;
          margin-top: 8px;
          color: rgba(233, 236, 245, 0.4);
        }

        .chat-list-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          margin-bottom: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .chat-list-item:hover {
          background: rgba(124, 108, 255, 0.15);
          border-color: rgba(124, 108, 255, 0.4);
          box-shadow: 0 4px 12px rgba(124, 108, 255, 0.2);
        }

        .chat-list-item-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(124, 108, 255, 0.2), rgba(61, 216, 255, 0.2));
          display: flex;
          align-items: center;
          justify-content: center;
          color: #7c6cff;
          flex-shrink: 0;
        }

        .chat-list-item-content {
          flex: 1;
          min-width: 0;
        }

        .chat-list-item-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .chat-list-item-type {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: rgba(124, 108, 255, 0.8);
          letter-spacing: 0.5px;
        }

        .chat-list-item-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          font-size: 10px;
          color: #fca5a5;
        }

        .chat-list-item-name {
          font-size: 15px;
          font-weight: 600;
          color: #e9ecf5;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .chat-list-item-id {
          font-size: 11px;
          color: rgba(233, 236, 245, 0.4);
          font-family: monospace;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
