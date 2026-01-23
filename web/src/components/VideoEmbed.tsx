import React from 'react';
import { extractVideoId } from '../utils/markdown';

interface VideoEmbedProps {
  url: string;
}

export default function VideoEmbed({ url }: VideoEmbedProps) {
  const videoInfo = extractVideoId(url);
  
  if (!videoInfo) return null;

  if (videoInfo.platform === 'youtube') {
    return (
      <div style={{
        position: 'relative',
        paddingBottom: '56.25%', // 16:9 aspect ratio
        height: 0,
        overflow: 'hidden',
        borderRadius: '8px',
        marginTop: '8px',
        background: '#000'
      }}>
        <iframe
          src={`https://www.youtube.com/embed/${videoInfo.id}`}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%'
          }}
        />
      </div>
    );
  }

  if (videoInfo.platform === 'vimeo') {
    return (
      <div style={{
        position: 'relative',
        paddingBottom: '56.25%',
        height: 0,
        overflow: 'hidden',
        borderRadius: '8px',
        marginTop: '8px',
        background: '#000'
      }}>
        <iframe
          src={`https://player.vimeo.com/video/${videoInfo.id}`}
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%'
          }}
        />
      </div>
    );
  }

  return null;
}
