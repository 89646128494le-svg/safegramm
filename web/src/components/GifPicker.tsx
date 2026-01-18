import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Loader, Image as ImageIcon } from 'lucide-react';

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

interface GifItem {
  id: string;
  title: string;
  images: {
    fixed_height: { url: string; width: string; height: string };
    original: { url: string; width: string; height: string };
  };
}

const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || 'YOUR_GIPHY_API_KEY';

export default function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGif, setSelectedGif] = useState<string | null>(null);

  const fetchTrendingGifs = useCallback(async () => {
    if (!GIPHY_API_KEY || GIPHY_API_KEY === 'YOUR_GIPHY_API_KEY') return;

    setLoading(true);
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=25`
      );
      const data = await response.json();
      setGifs(data.data || []);
    } catch (error) {
      console.error('Failed to fetch trending GIFs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrendingGifs();
  }, [fetchTrendingGifs]);

  const searchGifs = useCallback(async (query: string) => {
    if (!query.trim() || !GIPHY_API_KEY || GIPHY_API_KEY === 'YOUR_GIPHY_API_KEY') {
      if (!query.trim()) {
        fetchTrendingGifs();
      }
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=25`
      );
      const data = await response.json();
      setGifs(data.data || []);
    } catch (error) {
      console.error('Failed to search GIFs:', error);
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }, [fetchTrendingGifs]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchQuery) {
        searchGifs(searchQuery);
      } else {
        fetchTrendingGifs();
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, searchGifs, fetchTrendingGifs]);

  const handleGifSelect = (gif: GifItem) => {
    setSelectedGif(gif.id);
    setTimeout(() => {
      onSelect(gif.images.original.url);
      onClose();
    }, 200);
  };

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.9, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
        staggerChildren: 0.03
      }
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      y: 20,
      transition: { duration: 0.2 }
    }
  };

  const gifVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: (i: number) => ({
      opacity: 1,
      scale: 1,
      transition: {
        delay: i * 0.03,
        type: "spring",
        stiffness: 300,
        damping: 25
      }
    })
  };

  return (
    <AnimatePresence>
      <motion.div
        className="gif-picker-container"
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={containerVariants}
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          zIndex: 1000,
          width: '420px',
          maxHeight: '600px',
          background: 'rgba(11, 16, 32, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(124, 108, 255, 0.3)',
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(124, 108, 255, 0.2)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 700,
            fontSize: '18px',
            color: '#e9ecf5'
          }}>
            <ImageIcon size={20} />
            <span>GIF</span>
          </div>
          <motion.button
            onClick={onClose}
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#e9ecf5',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </motion.button>
        </div>

        <div style={{
          padding: '16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'rgba(233, 236, 245, 0.5)',
                pointerEvents: 'none'
              }}
            />
            <input
              type="text"
              placeholder="Поиск GIF..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px 12px 40px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                color: '#e9ecf5',
                fontSize: '14px',
                outline: 'none',
                transition: 'all 0.2s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(124, 108, 255, 0.5)';
                e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                e.target.style.boxShadow = '0 0 0 3px rgba(124, 108, 255, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>
        </div>

        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px'
        }}>
          {loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                gridColumn: '1 / -1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                color: 'rgba(233, 236, 245, 0.6)'
              }}
            >
              <Loader size={32} className="spinner" style={{
                animation: 'spin 1s linear infinite',
                marginBottom: '12px'
              }} />
              <span>Загрузка GIF...</span>
            </motion.div>
          ) : gifs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                gridColumn: '1 / -1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                textAlign: 'center',
                color: 'rgba(233, 236, 245, 0.6)'
              }}
            >
              {!GIPHY_API_KEY || GIPHY_API_KEY === 'YOUR_GIPHY_API_KEY' ? (
                <>
                  <ImageIcon size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                  <p style={{ marginBottom: '8px', fontWeight: 600 }}>Нужен API ключ Giphy</p>
                  <p style={{ fontSize: '12px', opacity: 0.7 }}>
                    Получите на https://developers.giphy.com/
                  </p>
                  <p style={{ fontSize: '12px', opacity: 0.7 }}>
                    И установите в .env: VITE_GIPHY_API_KEY=ваш_ключ
                  </p>
                </>
              ) : (
                <>
                  <ImageIcon size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                  <p>Ничего не найдено</p>
                </>
              )}
            </motion.div>
          ) : (
            gifs.map((gif, index) => (
              <motion.div
                key={gif.id}
                custom={index}
                variants={gifVariants}
                initial="hidden"
                animate="visible"
                whileHover={{
                  scale: 1.1,
                  zIndex: 10,
                  transition: { type: "spring", stiffness: 400, damping: 17 }
                }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleGifSelect(gif)}
                style={{
                  position: 'relative',
                  aspectRatio: '1',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: selectedGif === gif.id
                    ? '2px solid rgba(124, 108, 255, 0.8)'
                    : '2px solid rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.2s'
                }}
              >
                <img
                  src={gif.images.fixed_height.url}
                  alt={gif.title}
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
                {selectedGif === gif.id && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(124, 108, 255, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.3 }}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #7c6cff, #3dd8ff)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#0a0e1a',
                        fontSize: '20px'
                      }}
                    >
                      ✓
                    </motion.div>
                  </motion.div>
                )}
              </motion.div>
            ))
          )}
        </div>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @media (max-width: 768px) {
            .gif-picker-container {
              position: fixed;
              bottom: 0;
              right: 0;
              left: 0;
              width: 100%;
              max-height: 80vh;
              border-radius: 20px 20px 0 0;
            }
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );
}
