/**
 * Bots Page - Страница ботов
 */

import React from 'react';
import './Bots.css';

interface BotsProps {
  wsManager: any;
  user: any;
}

export default function Bots({ wsManager, user }: BotsProps) {
  return (
    <div className="bots-page">
      <h2>🤖 Боты</h2>
      <p>Функции управления ботами будут добавлены в следующих версиях.</p>
    </div>
  );
}
