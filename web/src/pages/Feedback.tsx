
import React, { useState } from 'react';
import { api } from '../services/api';
import { showToast } from '../components/Toast';

export default function Feedback() {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!subject.trim()) {
      showToast('Введите тему', 'warning');
      return;
    }
    if (!body.trim()) {
      showToast('Введите описание проблемы или идеи', 'warning');
      return;
    }

    try {
      setLoading(true);
      await api('/api/feedback', 'POST', { subject: subject.trim(), body: body.trim() });
      setSubject('');
      setBody('');
      showToast('Спасибо за обратную связь! Мы обязательно учтём ваше мнение.', 'success');
    } catch (e: any) {
      showToast('Ошибка отправки: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{padding: '24px', maxWidth: 800, margin: '0 auto'}}>
      <h2 style={{marginBottom: '8px', fontSize: '28px', fontWeight: '700'}}>Обратная связь</h2>
      <p className="small" style={{marginBottom: '24px', color: 'var(--subtle, #9ca3af)'}}>
        Поделитесь своими идеями, сообщите о проблеме или предложите улучшение
      </p>
      
      <div style={{
        padding: '24px',
        background: 'var(--panel, rgba(31, 41, 55, 0.6))',
        border: '1px solid var(--border, #374151)',
        borderRadius: '12px'
      }}>
        <div style={{marginBottom: '20px'}}>
          <label style={{display: 'block', marginBottom: '8px', fontWeight: '600'}}>
            Тема <span style={{color: '#ef4444'}}>*</span>
          </label>
          <input 
            placeholder="Кратко опишите проблему или идею"
            value={subject} 
            onChange={e=>setSubject(e.target.value)}
            maxLength={100}
            style={{
              width: '100%',
              padding: '12px',
              background: 'var(--panel-2, #111827)',
              border: '1px solid var(--border, #374151)',
              borderRadius: '8px',
              color: 'var(--fg, #e5e7eb)',
              fontSize: '14px'
            }}
            onKeyPress={e => e.key === 'Enter' && submit()}
          />
          <div className="small" style={{marginTop: '4px', color: 'var(--subtle, #9ca3af)', textAlign: 'right'}}>
            {subject.length}/100
          </div>
        </div>

        <div style={{marginBottom: '24px'}}>
          <label style={{display: 'block', marginBottom: '8px', fontWeight: '600'}}>
            Описание <span style={{color: '#ef4444'}}>*</span>
          </label>
          <textarea 
            placeholder="Опишите проблему или идею подробнее..."
            value={body} 
            onChange={e=>setBody(e.target.value)}
            maxLength={2000}
            rows={8}
            style={{
              width: '100%',
              padding: '12px',
              background: 'var(--panel-2, #111827)',
              border: '1px solid var(--border, #374151)',
              borderRadius: '8px',
              color: 'var(--fg, #e5e7eb)',
              fontFamily: 'inherit',
              resize: 'vertical',
              minHeight: '150px'
            }}
          />
          <div className="small" style={{marginTop: '4px', color: 'var(--subtle, #9ca3af)', textAlign: 'right'}}>
            {body.length}/2000
          </div>
        </div>

        <button 
          onClick={submit}
          disabled={loading || !subject.trim() || !body.trim()}
          style={{
            width: '100%',
            padding: '14px 24px',
            background: (loading || !subject.trim() || !body.trim()) ? '#6b7280' : 'var(--accent, #3b82f6)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: (loading || !subject.trim() || !body.trim()) ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: '600',
            opacity: (loading || !subject.trim() || !body.trim()) ? 0.6 : 1
          }}
        >
          {loading ? 'Отправка...' : '📤 Отправить'}
        </button>
      </div>

      <div style={{
        marginTop: '24px',
        padding: '16px',
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '8px'
      }}>
        <div className="small" style={{color: 'var(--accent, #3b82f6)'}}>
          💡 <strong>Совет:</strong> Чем подробнее вы опишете проблему или идею, тем быстрее мы сможем помочь или реализовать улучшение.
        </div>
      </div>
    </div>
  );
}
