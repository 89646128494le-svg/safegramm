import React, { useState } from 'react';
import { exportChatToJSON, exportChatToTXT } from '../utils/exportChat';
import { exportChatToPDF, exportChatMedia } from '../utils/exportChatExtended';
import { showToast } from './Toast';

interface ExportChatDialogProps {
  chatId: string;
  chatName: string;
  messages: any[];
  onClose: () => void;
}

export default function ExportChatDialog({
  chatId,
  chatName,
  messages,
  onClose,
}: ExportChatDialogProps) {
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState<'json' | 'txt' | 'pdf' | 'media' | null>(null);

  const handleExport = async (type: 'json' | 'txt' | 'pdf' | 'media') => {
    try {
      setExporting(true);
      setExportType(type);

      const chatInfo = {
        id: chatId,
        name: chatName,
        type: 'dm' as const,
      };

      switch (type) {
        case 'json':
          exportChatToJSON(messages, chatName);
          showToast('Экспорт в JSON завершен', 'success');
          break;
        case 'txt':
          exportChatToTXT(messages, chatName);
          showToast('Экспорт в TXT завершен', 'success');
          break;
        case 'pdf':
          await exportChatToPDF(messages, chatInfo);
          showToast('Экспорт в PDF завершен', 'success');
          break;
        case 'media':
          await exportChatMedia(messages, chatInfo);
          showToast('Экспорт медиа завершен', 'success');
          break;
      }
    } catch (e: any) {
      showToast('Ошибка экспорта: ' + e.message, 'error');
    } finally {
      setExporting(false);
      setExportType(null);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '500px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        border: '1px solid var(--border)'
      }}>
        <div style={{
          padding: '24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '24px', color: 'var(--text-primary)' }}>Экспорт чата</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              padding: '4px 8px'
            }}
          >
            ✕
          </button>
        </div>

        <div style={{
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>
            Экспортировать: <strong>{chatName}</strong> ({messages.length} сообщений)
          </div>

          <button
            onClick={() => handleExport('json')}
            disabled={exporting}
            style={{
              padding: '12px 16px',
              background: exporting && exportType === 'json' ? 'var(--bg-secondary)' : 'var(--accent-primary)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: exporting ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {exporting && exportType === 'json' ? '⏳' : '📄'} Экспорт в JSON
          </button>

          <button
            onClick={() => handleExport('txt')}
            disabled={exporting}
            style={{
              padding: '12px 16px',
              background: exporting && exportType === 'txt' ? 'var(--bg-secondary)' : 'var(--accent-primary)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: exporting ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {exporting && exportType === 'txt' ? '⏳' : '📝'} Экспорт в TXT
          </button>

          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting}
            style={{
              padding: '12px 16px',
              background: exporting && exportType === 'pdf' ? 'var(--bg-secondary)' : 'var(--accent-primary)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: exporting ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {exporting && exportType === 'pdf' ? '⏳' : '📄'} Экспорт в PDF
          </button>

          <button
            onClick={() => handleExport('media')}
            disabled={exporting}
            style={{
              padding: '12px 16px',
              background: exporting && exportType === 'media' ? 'var(--bg-secondary)' : 'var(--accent-primary)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: exporting ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {exporting && exportType === 'media' ? '⏳' : '📎'} Экспорт медиа
          </button>
        </div>
      </div>
    </div>
  );
}
