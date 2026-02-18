/**
 * Feedback Page - Страница обратной связи
 */

import { useState } from 'react';
import { apiClient } from '../core/api/client';
import './Feedback.css';

interface FeedbackProps {
  user: any;
}

export default function Feedback({ user: _user }: FeedbackProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!subject.trim()) {
      alert('Введите тему');
      return;
    }
    if (!body.trim()) {
      alert('Введите описание проблемы или идеи');
      return;
    }

    try {
      setLoading(true);
      await apiClient.post('/api/feedback', {
        subject: subject.trim(),
        body: body.trim()
      });
      setSubject('');
      setBody('');
      alert('Спасибо за обратную связь! Мы обязательно учтём ваше мнение.');
    } catch (error: any) {
      alert('Ошибка отправки: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="feedback-page">
      <h2>💭 Обратная связь</h2>
      <p className="feedback-description">
        Поделитесь своими идеями, сообщите о проблеме или предложите улучшение
      </p>
      
      <div className="feedback-form">
        <div className="form-group">
          <label>
            Тема <span className="required">*</span>
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Краткое описание..."
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label>
            Описание <span className="required">*</span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Подробное описание проблемы, идеи или предложения..."
            className="form-textarea"
            rows={8}
          />
        </div>

        <button
          onClick={submit}
          disabled={loading || !subject.trim() || !body.trim()}
          className="btn btn-primary"
        >
          {loading ? 'Отправка...' : 'Отправить'}
        </button>
      </div>
    </div>
  );
}
