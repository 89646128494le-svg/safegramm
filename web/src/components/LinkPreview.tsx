import React, { useEffect, useState } from 'react';

interface LinkPreviewProps {
  url: string;
}

interface PreviewData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

export default function LinkPreview({ url }: LinkPreviewProps) {
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        setLoading(true);
        setError(false);
        
        // Используем серверный endpoint для получения Open Graph данных
        // Или можно использовать публичный API
        const response = await fetch(`https://api.linkpreview.net/?q=${encodeURIComponent(url)}`, {
          headers: {
            'X-Linkpreview-Api-Key': 'YOUR_API_KEY' // Нужно получить ключ или использовать свой сервер
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setPreview({
            title: data.title,
            description: data.description,
            image: data.image,
            siteName: data.site_name || new URL(url).hostname,
          });
        } else {
          // Fallback: пытаемся получить через свой сервер
          try {
            const serverResponse = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
            if (serverResponse.ok) {
              const data = await serverResponse.json();
              setPreview(data);
            } else {
              setError(true);
            }
          } catch {
            setError(true);
          }
        }
      } catch (e) {
        console.error('Failed to fetch link preview:', e);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [url]);

  if (loading) {
    return (
      <div style={{
        padding: '12px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        marginTop: '8px',
        border: '1px solid var(--border)',
        fontSize: '12px',
        color: 'var(--text-secondary)'
      }}>
        Загрузка превью...
      </div>
    );
  }

  if (error || !preview) {
    return null;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block',
        padding: '12px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        marginTop: '8px',
        border: '1px solid var(--border)',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-tertiary)';
        e.currentTarget.style.borderColor = 'var(--accent-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--bg-secondary)';
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      {preview.image && (
        <img
          src={preview.image}
          alt={preview.title || 'Preview'}
          style={{
            width: '100%',
            maxHeight: '200px',
            objectFit: 'cover',
            borderRadius: '6px',
            marginBottom: '8px'
          }}
        />
      )}
      <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '4px', color: 'var(--text-primary)' }}>
        {preview.title || preview.siteName}
      </div>
      {preview.description && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
          {preview.description.length > 150 ? preview.description.slice(0, 150) + '...' : preview.description}
        </div>
      )}
      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
        {preview.siteName || new URL(url).hostname}
      </div>
    </a>
  );
}
