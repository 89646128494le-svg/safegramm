import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface Story {
  id: string;
  userId: string;
  type: 'image' | 'video' | 'text';
  contentUrl?: string;
  text?: string;
  backgroundColor?: string;
  expiresAt: number;
  createdAt: number;
  viewed?: boolean;
  user?: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
}

interface StoriesGroup {
  user: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  stories: Story[];
}

interface StoriesProps {
  onClose: () => void;
}

export default function Stories({ onClose }: StoriesProps) {
  const [storiesGroups, setStoriesGroups] = useState<StoriesGroup[]>([]);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStories();
  }, []);

  const loadStories = async () => {
    try {
      setLoading(true);
      const data = await api('/api/stories');
      setStoriesGroups(data.stories || []);
    } catch (e) {
      console.error('Failed to load stories:', e);
    } finally {
      setLoading(false);
    }
  };

  const currentGroup = storiesGroups[currentGroupIndex];
  const currentStory = currentGroup?.stories[currentStoryIndex];

  const nextStory = () => {
    if (!currentGroup) return;
    
    if (currentStoryIndex < currentGroup.stories.length - 1) {
      setCurrentStoryIndex(currentStoryIndex + 1);
    } else if (currentGroupIndex < storiesGroups.length - 1) {
      setCurrentGroupIndex(currentGroupIndex + 1);
      setCurrentStoryIndex(0);
    } else {
      onClose();
    }
  };

  const prevStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(currentStoryIndex - 1);
    } else if (currentGroupIndex > 0) {
      setCurrentGroupIndex(currentGroupIndex - 1);
      const prevGroup = storiesGroups[currentGroupIndex - 1];
      setCurrentStoryIndex(prevGroup.stories.length - 1);
    }
  };

  const viewStory = async (storyId: string) => {
    try {
      await api(`/api/stories/${storyId}/view`, 'POST');
    } catch (e) {
      console.error('Failed to mark story as viewed:', e);
    }
  };

  useEffect(() => {
    if (currentStory && !currentStory.viewed) {
      viewStory(currentStory.id);
    }
  }, [currentStory]);

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}>
        <div style={{ color: 'white' }}>Загрузка историй...</div>
      </div>
    );
  }

  if (storiesGroups.length === 0) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}>
        <div style={{ color: 'white', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📸</div>
          <div>Нет активных историй</div>
          <button
            onClick={onClose}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              background: 'var(--accent-primary)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Закрыть
          </button>
        </div>
      </div>
    );
  }

  if (!currentStory) {
    return null;
  }

  const progress = ((currentStoryIndex + 1) / (currentGroup?.stories.length || 1)) * 100;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: currentStory.backgroundColor || '#000',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column'
      }}
      onClick={nextStory}
    >
      {/* Прогресс-бар */}
      <div style={{
        display: 'flex',
        gap: '4px',
        padding: '12px',
        background: 'rgba(0, 0, 0, 0.3)'
      }}>
        {currentGroup.stories.map((_, idx) => (
          <div
            key={idx}
            style={{
              flex: 1,
              height: '3px',
              background: idx <= currentStoryIndex ? 'white' : 'rgba(255, 255, 255, 0.3)',
              borderRadius: '2px',
              transition: 'background 0.3s'
            }}
          />
        ))}
      </div>

      {/* Заголовок */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px',
        background: 'rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
          {currentGroup.user.avatarUrl ? (
            <img
              src={currentGroup.user.avatarUrl}
              alt={currentGroup.user.username}
              style={{ width: '32px', height: '32px', borderRadius: '50%' }}
            />
          ) : (
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold'
            }}>
              {currentGroup.user.username[0].toUpperCase()}
            </div>
          )}
          <span>{currentGroup.user.username}</span>
          <span style={{ fontSize: '12px', opacity: 0.7 }}>
            {new Date(currentStory.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '4px 8px'
          }}
        >
          ✕
        </button>
      </div>

      {/* Контент истории */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}>
        {currentStory.type === 'text' ? (
          <div style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: 'white',
            textAlign: 'center',
            padding: '24px',
            maxWidth: '80%'
          }}>
            {currentStory.text}
          </div>
        ) : currentStory.type === 'image' && currentStory.contentUrl ? (
          <img
            src={currentStory.contentUrl}
            alt="Story"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain'
            }}
          />
        ) : currentStory.type === 'video' && currentStory.contentUrl ? (
          <video
            src={currentStory.contentUrl}
            autoPlay
            controls
            style={{
              maxWidth: '100%',
              maxHeight: '100%'
            }}
          />
        ) : null}

        {/* Навигация */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '30%',
            cursor: 'pointer'
          }}
          onClick={(e) => {
            e.stopPropagation();
            prevStory();
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '30%',
            cursor: 'pointer'
          }}
          onClick={(e) => {
            e.stopPropagation();
            nextStory();
          }}
        />
      </div>
    </div>
  );
}

