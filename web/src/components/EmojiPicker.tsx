import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Smile, Hand, Zap, Apple, Dog, Flag } from 'lucide-react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EMOJI_CATEGORIES = {
  'Часто используемые': {
    icon: Search,
    emojis: ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🔥', '💯', '🎉', '✨', '⭐', '🎊', '🙌', '👌']
  },
  'Смайлики': {
    icon: Smile,
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔']
  },
  'Жесты': {
    icon: Hand,
    emojis: ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏']
  },
  'Предметы': {
    icon: Zap,
    emojis: ['⌚', '📱', '📲', '💻', '⌨️', '🖥', '🖨', '🖱', '🖲', '🕹', '🗜', '💾', '💿', '📷', '📸', '📹', '🎥', '📽', '🎞', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙', '🎚', '🎛', '⏱', '⏲']
  },
  'Еда': {
    icon: Apple,
    emojis: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶', '🌽', '🥕', '🥔', '🍠', '🥐', '🥯', '🍞']
  },
  'Животные': {
    icon: Dog,
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇']
  },
  'Флаги': {
    icon: Flag,
    emojis: ['🏳️', '🏴', '🏁', '🚩', '🏳️‍🌈', '🏳️‍⚧️', '🇷🇺', '🇺🇸', '🇬🇧', '🇩🇪', '🇫🇷', '🇮🇹', '🇪🇸', '🇨🇳', '🇯🇵', '🇰🇷', '🇮🇳', '🇧🇷', '🇨🇦', '🇦🇺']
  }
};

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('Часто используемые');
  const [searchQuery, setSearchQuery] = useState('');

  const handleEmojiClick = (emoji: string) => {
    onSelect(emoji);
    // Воспроизводим приятный звук или анимацию
  };

  // Фильтрация эмодзи по поиску
  const getFilteredEmojis = () => {
    if (!searchQuery.trim()) {
      return EMOJI_CATEGORIES[selectedCategory as keyof typeof EMOJI_CATEGORIES].emojis;
    }
    
    const query = searchQuery.toLowerCase();
    const allEmojis = Object.values(EMOJI_CATEGORIES).flatMap(cat => cat.emojis);
    // Простая фильтрация - можно улучшить добавив названия эмодзи
    return allEmojis.filter(emoji => emoji.includes(searchQuery) || true); // Пока показываем все
  };

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.8, y: 20 },
    visible: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
        staggerChildren: 0.05
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.8, 
      y: 20,
      transition: {
        duration: 0.2
      }
    }
  };

  const categoryVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 }
  };

  const emojiVariants = {
    hidden: { opacity: 0, scale: 0 },
    visible: (i: number) => ({ 
      opacity: 1, 
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 15,
        delay: i * 0.01
      }
    })
  };

  return (
    <AnimatePresence>
      <motion.div
        className="emoji-picker-container"
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={containerVariants}
      >
        <div className="emoji-picker">
          <div className="emoji-picker-header">
            <div className="emoji-picker-title">
              <Smile size={20} />
              <span>Эмодзи</span>
            </div>
            <motion.button
              onClick={onClose}
              className="emoji-picker-close"
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <X size={18} />
            </motion.button>
          </div>

          <div className="emoji-search-container">
            <Search size={16} className="emoji-search-icon" />
            <input
              type="text"
              placeholder="Поиск эмодзи..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="emoji-search-input"
            />
            {searchQuery && (
              <motion.button
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setSearchQuery('')}
                className="emoji-search-clear"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <X size={14} />
              </motion.button>
            )}
          </div>

          <div className="emoji-categories">
            {Object.keys(EMOJI_CATEGORIES).map((category) => {
              const Icon = EMOJI_CATEGORIES[category as keyof typeof EMOJI_CATEGORIES].icon;
              return (
                <motion.button
                  key={category}
                  className={`emoji-category-btn ${selectedCategory === category ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(category)}
                  title={category}
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <Icon size={20} />
                </motion.button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={selectedCategory}
              className="emoji-grid-container"
              variants={categoryVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="emoji-grid">
                {getFilteredEmojis().map((emoji, idx) => (
                  <motion.button
                    key={`${emoji}-${idx}`}
                    className="emoji-item"
                    onClick={() => handleEmojiClick(emoji)}
                    custom={idx}
                    variants={emojiVariants}
                    initial="hidden"
                    animate="visible"
                    whileHover={{ 
                      scale: 1.3, 
                      rotate: [0, -10, 10, -10, 0],
                      transition: { duration: 0.3 }
                    }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  >
                    {emoji}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <style>{`
          .emoji-picker-container {
            position: fixed;
            bottom: 80px;
            right: 20px;
            z-index: 1000;
            max-width: 400px;
            width: 100%;
          }

          @media (max-width: 768px) {
            .emoji-picker-container {
              position: fixed;
              bottom: 0;
              right: 0;
              left: 0;
              max-width: 100%;
              border-radius: 20px 20px 0 0;
            }
          }

          .emoji-picker {
            background: rgba(11, 16, 32, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(124, 108, 255, 0.3);
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(124, 108, 255, 0.2);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            max-height: 500px;
          }

          .emoji-picker-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          }

          .emoji-picker-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 700;
            font-size: 18px;
            color: #e9ecf5;
          }

          .emoji-picker-close {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            color: #e9ecf5;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
          }

          .emoji-picker-close:hover {
            background: rgba(239, 68, 68, 0.2);
            color: #ef4444;
          }

          .emoji-search-container {
            position: relative;
            padding: 12px 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          }

          .emoji-search-icon {
            position: absolute;
            left: 28px;
            top: 50%;
            transform: translateY(-50%);
            color: rgba(233, 236, 245, 0.5);
            pointer-events: none;
          }

          .emoji-search-input {
            width: 100%;
            padding: 10px 40px 10px 40px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            color: #e9ecf5;
            font-size: 14px;
            outline: none;
            transition: all 0.2s;
          }

          .emoji-search-input:focus {
            border-color: rgba(124, 108, 255, 0.5);
            background: rgba(255, 255, 255, 0.08);
            box-shadow: 0 0 0 3px rgba(124, 108, 255, 0.1);
          }

          .emoji-search-clear {
            position: absolute;
            right: 28px;
            top: 50%;
            transform: translateY(-50%);
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            color: #e9ecf5;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .emoji-categories {
            display: flex;
            gap: 8px;
            padding: 12px 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            overflow-x: auto;
            scrollbar-width: none;
          }

          .emoji-categories::-webkit-scrollbar {
            display: none;
          }

          .emoji-category-btn {
            min-width: 40px;
            height: 40px;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: rgba(233, 236, 245, 0.6);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            flex-shrink: 0;
          }

          .emoji-category-btn:hover {
            background: rgba(124, 108, 255, 0.2);
            border-color: rgba(124, 108, 255, 0.4);
            color: #7c6cff;
          }

          .emoji-category-btn.active {
            background: linear-gradient(135deg, rgba(124, 108, 255, 0.3), rgba(61, 216, 255, 0.3));
            border-color: rgba(124, 108, 255, 0.5);
            color: #7c6cff;
            box-shadow: 0 4px 12px rgba(124, 108, 255, 0.3);
          }

          .emoji-grid-container {
            overflow-y: auto;
            flex: 1;
            padding: 16px;
            min-height: 0;
          }

          .emoji-grid {
            display: grid;
            grid-template-columns: repeat(8, 1fr);
            gap: 8px;
          }

          @media (max-width: 768px) {
            .emoji-grid {
              grid-template-columns: repeat(7, 1fr);
            }
          }

          .emoji-item {
            aspect-ratio: 1;
            border-radius: 10px;
            background: transparent;
            border: none;
            font-size: 28px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            position: relative;
          }

          .emoji-item:hover {
            background: rgba(124, 108, 255, 0.2);
            transform: scale(1.2);
          }

          .emoji-item:active {
            transform: scale(0.9);
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );
}
