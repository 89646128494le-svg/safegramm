import React from 'react';
import { Link } from 'react-router-dom';

export default function LandingFooter() {
  return (
    <footer className="landing-footer" role="contentinfo">
      <div className="landing-footer-inner">
        <nav className="landing-footer-nav" aria-label="Юридические ссылки">
          <Link to="/privacy">Privacy Policy</Link>
          <span className="landing-footer-sep" aria-hidden>·</span>
          <Link to="/terms">Terms of Service</Link>
          <span className="landing-footer-sep" aria-hidden>·</span>
          <Link to="/join">Присоединиться к команде</Link>
          <span className="landing-footer-sep" aria-hidden>·</span>
          <Link to="/support">Support</Link>
        </nav>
        <p className="landing-footer-copy">
          © {new Date().getFullYear()} SafeGram. Защищённое общение.
        </p>
      </div>
    </footer>
  );
}
