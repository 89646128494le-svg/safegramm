import React from 'react';
import { Link } from 'react-router-dom';
import logoLightUrl from '../assets/brand/logo-mark-light.svg';

export default function LandingFooter() {
  return (
    <footer className="landing-footer" role="contentinfo">
      <div className="landing-footer-inner">
        <div className="landing-footer-brand">
          <img src={logoLightUrl} alt="SafeGram" width={28} height={28} />
          <span>SafeGram</span>
        </div>
        <nav className="landing-footer-nav" aria-label="??????????? ??????">
          <Link to="/privacy">Privacy Policy</Link>
          <span className="landing-footer-sep" aria-hidden>?</span>
          <Link to="/terms">Terms of Service</Link>
          <span className="landing-footer-sep" aria-hidden>?</span>
          <Link to="/join">?????????????? ? ???????</Link>
          <span className="landing-footer-sep" aria-hidden>?</span>
          <Link to="/support">Support</Link>
        </nav>
        <p className="landing-footer-copy">
          ? {new Date().getFullYear()} SafeGram. ?????????? ???????.
        </p>
      </div>
    </footer>
  );
}
