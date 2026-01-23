import React from 'react';

interface MessagePreviewProps {
  text: string;
  attachmentUrl?: string;
  onSend: () => void;
  onCancel: () => void;
}

export default function MessagePreview({ text, attachmentUrl, onSend, onCancel }: MessagePreviewProps) {
  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--bg-primary)',
      borderRadius: '12px',
      padding: '16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      border: '1px solid var(--border)',
      maxWidth: '500px',
      width: '90%',
      zIndex: 1000
    }}>
      <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-primary)' }}>
        Предпросмотр сообщения
      </div>
      
      <div style={{
        padding: '12px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        marginBottom: '12px',
        maxHeight: '300px',
        overflowY: 'auto'
      }}>
        {text && (
          <div className="message-text" style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
            {text}
          </div>
        )}
        {attachmentUrl && (
          <div style={{ marginTop: '8px' }}>
            {attachmentUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
              <img src={attachmentUrl} alt="Preview" style={{ maxWidth: '100%', borderRadius: '8px' }} />
            ) : (
              <div style={{ padding: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                📎 {attachmentUrl.split('/').pop()}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            cursor: 'pointer'
          }}
        >
          Отмена
        </button>
        <button
          onClick={onSend}
          style={{
            padding: '8px 16px',
            background: 'var(--accent-primary)',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Отправить
        </button>
      </div>
    </div>
  );
}
