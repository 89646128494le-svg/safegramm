
import React, { useEffect, useState } from 'react';
import { api, getApiBaseUrl } from '../services/api';

interface MediaItem {
  id: string;
  messageId: string;
  chatId: string;
  url: string;
  kind: 'image' | 'video' | 'audio' | 'file';
  createdAt: number;
}

interface MediaGalleryProps {
  chatId: string;
  onClose: () => void;
}

export default function MediaGallery({ chatId, onClose }: MediaGalleryProps) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [filter, setFilter] = useState<'all' | 'image' | 'video' | 'audio' | 'file'>('all');

  useEffect(() => {
    loadMedia();
  }, [chatId, filter]);

  const loadMedia = async () => {
    try {
      setLoading(true);
      const data = await api(`/api/chats/${chatId}/attachments?kind=${filter === 'all' ? '' : filter}`);
      setMedia(data.attachments || []);
    } catch (e) {
      console.error('Failed to load media:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredMedia = filter === 'all' 
    ? media 
    : media.filter(m => m.kind === filter);

  const openMedia = (item: MediaItem) => {
    setSelectedMedia(item);
  };

  const closeMedia = () => {
    setSelectedMedia(null);
  };

  const getMediaUrl = (url: string): string => {
    if (!url) return '';
    // Если URL уже полный, используем как есть
    if (url.startsWith('http')) return url;
    // Иначе формируем полный URL
    return `${getApiBaseUrl()}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const downloadMedia = (item: MediaItem) => {
    const fullUrl = getMediaUrl(item.url);
    const link = document.createElement('a');
    link.href = fullUrl;
    link.download = item.url.split('/').pop() || 'download';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="media-gallery">
      <div className="media-gallery-header">
        <h3>Медиа</h3>
        <button onClick={onClose} className="close-btn">✕</button>
      </div>

      <div className="media-filters">
        <button 
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Все
        </button>
        <button 
          className={`filter-btn ${filter === 'image' ? 'active' : ''}`}
          onClick={() => setFilter('image')}
        >
          📷 Фото
        </button>
        <button 
          className={`filter-btn ${filter === 'video' ? 'active' : ''}`}
          onClick={() => setFilter('video')}
        >
          🎥 Видео
        </button>
        <button 
          className={`filter-btn ${filter === 'audio' ? 'active' : ''}`}
          onClick={() => setFilter('audio')}
        >
          🎵 Аудио
        </button>
        <button 
          className={`filter-btn ${filter === 'file' ? 'active' : ''}`}
          onClick={() => setFilter('file')}
        >
          📄 Файлы
        </button>
      </div>

      {loading ? (
        <div className="media-loading">Загрузка...</div>
      ) : filteredMedia.length === 0 ? (
        <div className="media-empty">Нет медиа файлов</div>
      ) : (
        <div className="media-grid">
          {filteredMedia.map((item) => (
            <div 
              key={item.id} 
              className="media-item"
              onClick={() => openMedia(item)}
            >
              {item.kind === 'image' && (
                <img src={getMediaUrl(item.url)} alt="media" loading="lazy" />
              )}
              {item.kind === 'video' && (
                <div className="media-preview video-preview">
                  <video src={getMediaUrl(item.url)} />
                  <div className="play-overlay">▶</div>
                </div>
              )}
              {item.kind === 'audio' && (
                <div className="media-preview audio-preview">
                  <span>🎵</span>
                </div>
              )}
              {item.kind === 'file' && (
                <div className="media-preview file-preview">
                  <span>📄</span>
                </div>
              )}
              <div className="media-overlay">
                <button 
                  className="media-download-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadMedia(item);
                  }}
                  title="Скачать"
                >
                  ⬇
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedMedia && (
        <div className="media-viewer" onClick={closeMedia}>
          <div className="media-viewer-content" onClick={(e) => e.stopPropagation()}>
            <button className="media-viewer-close" onClick={closeMedia}>✕</button>
            {selectedMedia.kind === 'image' && (
              <img src={getMediaUrl(selectedMedia.url)} alt="media" />
            )}
            {selectedMedia.kind === 'video' && (
              <video src={getMediaUrl(selectedMedia.url)} controls autoPlay />
            )}
            {selectedMedia.kind === 'audio' && (
              <audio src={getMediaUrl(selectedMedia.url)} controls autoPlay />
            )}
            {selectedMedia.kind === 'file' && (
              <div className="media-file-viewer">
                <div className="file-icon">📄</div>
                <a 
                  href={getMediaUrl(selectedMedia.url)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="file-download-link"
                >
                  Скачать файл
                </a>
              </div>
            )}
            <div className="media-viewer-actions">
              <button onClick={() => downloadMedia(selectedMedia)}>
                ⬇ Скачать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




