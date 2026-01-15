
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface Sticker {
  id: string;
  packId: string;
  emoji: string;
  url: string;
  width: number;
  height: number;
}

interface StickerPack {
  id: string;
  name: string;
  title: string;
  thumbnailUrl?: string;
  isAnimated: boolean;
  stickerCount?: number;
}

interface StickerPickerProps {
  onSelect: (stickerId: string) => void;
  onClose: () => void;
}

export default function StickerPicker({ onSelect, onClose }: StickerPickerProps) {
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPacks();
  }, []);

  useEffect(() => {
    if (selectedPack) {
      loadStickers(selectedPack);
    }
  }, [selectedPack]);

  const loadPacks = async () => {
    try {
      setLoading(true);
      const data = await api('/api/sticker-packs');
      setPacks(data.packs || []);
      if (data.packs && data.packs.length > 0) {
        setSelectedPack(data.packs[0].id);
      }
    } catch (e) {
      console.error('Failed to load sticker packs:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadStickers = async (packId: string) => {
    try {
      const data = await api(`/api/sticker-packs/${packId}/stickers`);
      setStickers(data.stickers || []);
    } catch (e) {
      console.error('Failed to load stickers:', e);
    }
  };

  return (
    <div className="sticker-picker">
      <div className="sticker-picker-header">
        <h4>Стикеры</h4>
        <button onClick={onClose} className="close-btn">✕</button>
      </div>

      {loading ? (
        <div className="sticker-loading">Загрузка...</div>
      ) : (
        <>
          <div className="sticker-packs">
            {packs.map(pack => (
              <button
                key={pack.id}
                className={`sticker-pack-btn ${selectedPack === pack.id ? 'active' : ''}`}
                onClick={() => setSelectedPack(pack.id)}
                title={pack.name || pack.title}
              >
                {pack.thumbnailUrl ? (
                  <img src={pack.thumbnailUrl} alt={pack.name || pack.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div className="sticker-pack-placeholder" style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px'
                  }}>😀</div>
                )}
              </button>
            ))}
          </div>

          <div className="sticker-grid" style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px'
          }}>
            {stickers.length === 0 ? (
              <div style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: '24px',
                color: 'var(--text-tertiary)',
                fontStyle: 'italic'
              }}>
                Нет стикеров в этом наборе
              </div>
            ) : (
              stickers.map(sticker => (
                <button
                  key={sticker.id}
                  className="sticker-item"
                  onClick={() => {
                    onSelect(sticker.id);
                    onClose();
                  }}
                  title={sticker.emoji}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    aspectRatio: '1'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <img 
                    src={sticker.url} 
                    alt={sticker.emoji} 
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain'
                    }}
                  />
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}




