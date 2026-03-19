import React from 'react';
import { Link } from 'react-router-dom';
import logoPrimaryUrl from '../assets/brand/logo-primary.png';

export default function LandingFooter() {
  return (
    <footer className="landing-footer" role="contentinfo">
      <div className="landing-footer-inner">
        <div className="landing-footer-brand">
          <img src={logoPrimaryUrl} alt="SafeGram" width={32} height={32} />
          <span>SafeGram</span>
        </div>
        <nav className="landing-footer-nav" aria-label="Нижняя навигация">
          <Link to="/privacy">Политика конфиденциальности</Link>
          <span className="landing-footer-sep" aria-hidden>•</span>
          <Link to="/terms">Условия использования</Link>
          <span className="landing-footer-sep" aria-hidden>•</span>
          <Link to="/join">Присоединиться к команде</Link>
          <span className="landing-footer-sep" aria-hidden>•</span>
          <Link to="/support">Поддержка</Link>
        </nav>
        <p className="landing-footer-copy">
          © {new Date().getFullYear()} SafeGram. Все права защищены.
        </p>
      </div>
    </footer>
  );
}
