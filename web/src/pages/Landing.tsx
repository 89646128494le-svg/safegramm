
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Landing() {
  const nav = useNavigate();
  const accept = () => {
    localStorage.setItem('policiesAccepted','1');
    nav('/login');
  };
  return (
    <div style={{maxWidth: 820, margin: '6vh auto', padding: 24}}>
      <h1>SafeGram</h1>
      <p>Безопасный и удобный мессенджер для всех (от 7+). Перед началом используйте ссылки ниже, чтобы ознакомиться с документами.</p>
      <div className="card">
        <ul>
          <li><Link to="/privacy">Политика конфиденциальности</Link></li>
          <li><Link to="/terms">Пользовательское соглашение</Link></li>
        </ul>
        <p className="small">Нажимая кнопку ниже, вы подтверждаете согласие с документами.</p>
        <button onClick={accept}>Я согласен(а) → Перейти к входу</button>
      </div>
    </div>
  );
}
