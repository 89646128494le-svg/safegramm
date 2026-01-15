/**
 * Stories Component - Компонент историй
 */

import React from 'react';
import './Stories.css';

interface StoriesProps {
  onClose: () => void;
}

export default function Stories({ onClose }: StoriesProps) {
  return (
    <div className="stories-overlay" onClick={onClose}>
      <div className="stories-container" onClick={(e) => e.stopPropagation()}>
        <div className="stories-header">
          <h3>Истории</h3>
          <button onClick={onClose} className="btn-close">×</button>
        </div>
        <div className="stories-content">
          <p>Функции историй будут добавлены в следующих версиях.</p>
        </div>
      </div>
    </div>
  );
}
