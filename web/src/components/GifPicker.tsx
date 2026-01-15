
import React, { useState, useEffect, useRef } from 'react';

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

// Используем Giphy API (можно заменить на Tenor или другой)
const GIPHY_API_KEY = 'YOUR_GIPHY_API_KEY'; // Нужно получить на https://developers.giphy.com/
const GIPHY_TRENDING_URL = `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=24&rating=g`;
const GIPHY_SEARCH_URL = (query: string) => `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=24&rating=g`;

interface GifItem {
  id: string;
  images: {
    fixed_height: {
      url: string;
      width: string;
      height: string;
    };
    original: {
      url: string;
      width: string;
      height: string;
    };
  };
  title: string;
}

export default function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const searchTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    loadTrending();
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim()) {
      searchTimeoutRef.current = window.setTimeout(() => {
        searchGifs(searchQuery);
      }, 500);
    } else if (searchMode) {
      loadTrending();
      setSearchMode(false);
    }
  }, [searchQuery]);

  const loadTrending = async () => {
    try {
      setLoading(true);
      // Если нет API ключа, используем заглушку
      if (!GIPHY_API_KEY || GIPHY_API_KEY === 'YOUR_GIPHY_API_KEY') {
        setGifs([]);
        setLoading(false);
        return;
      }
      const response = await fetch(GIPHY_TRENDING_URL);
      const data = await response.json();
      setGifs(data.data || []);
    } catch (e) {
      console.error('Failed to load trending GIFs:', e);
      setGifs([]);
    } finally {
      setLoading(false);
    }
  };

  const searchGifs = async (query: string) => {
    try {
      setLoading(true);
      setSearchMode(true);
      if (!GIPHY_API_KEY || GIPHY_API_KEY === 'YOUR_GIPHY_API_KEY') {
        setGifs([]);
        setLoading(false);
        return;
      }
      const response = await fetch(GIPHY_SEARCH_URL(query));
      const data = await response.json();
      setGifs(data.data || []);
    } catch (e) {
      console.error('Failed to search GIFs:', e);
      setGifs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGifSelect = (gif: GifItem) => {
    // Используем оригинальный размер для лучшего качества
    onSelect(gif.images.original.url);
    onClose();
  };

  return (
    <div className="gif-picker">
      <div className="gif-picker-header">
        <h4>GIF</h4>
        <button onClick={onClose} className="close-btn">✕</button>
      </div>

      <div className="gif-search-bar">
        <input
          type="text"
          placeholder="Поиск GIF..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="gif-search-input"
        />
      </div>

      {loading ? (
        <div className="gif-loading">Загрузка...</div>
      ) : gifs.length === 0 ? (
        <div className="gif-empty">
          {!GIPHY_API_KEY || GIPHY_API_KEY === 'YOUR_GIPHY_API_KEY' ? (
            <div>
              <p>Для работы GIF-поиска нужен API ключ Giphy</p>
              <p className="small">Получите на https://developers.giphy.com/</p>
              <p className="small">И установите в GifPicker.tsx</p>
            </div>
          ) : (
            <p>Ничего не найдено</p>
          )}
        </div>
      ) : (
        <div className="gif-grid">
          {gifs.map(gif => (
            <div
              key={gif.id}
              className="gif-item"
              onClick={() => handleGifSelect(gif)}
            >
              <img
                src={gif.images.fixed_height.url}
                alt={gif.title}
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}




