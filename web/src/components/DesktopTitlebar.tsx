import React from 'react';
import logoGradientUrl from '../assets/brand/logo-mark-gradient.svg';

const TITLEBAR_H = 36;

export default function DesktopTitlebar() {
  const api = typeof window !== 'undefined' ? (window as any).electronAPI : null;
  if (!api) return null;

  return (
    <div
      className="desktop-titlebar"
      style={{
        height: TITLEBAR_H,
        minHeight: TITLEBAR_H,
        width: '100%',
        WebkitAppRegion: 'drag',
        appRegion: 'drag',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.97) 0%, rgba(15,23,42,0.92) 100%)',
        borderBottom: '1px solid rgba(124,108,255,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 14,
        paddingRight: 0,
        flexShrink: 0,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <img
          src={logoGradientUrl}
          alt="SafeGram"
          width={20}
          height={20}
          style={{
            width: 20,
            height: 20,
            objectFit: 'contain',
            opacity: 0.98,
            filter: 'drop-shadow(0 4px 14px rgba(77, 155, 255, 0.2))'
          }}
        />
        <span style={{ fontSize: 15, fontWeight: 800, color: '#7d86ff', letterSpacing: '-0.03em' }}>SafeGram</span>
      </div>
      <div
        style={{
          display: 'flex',
          height: '100%',
          WebkitAppRegion: 'no-drag',
          appRegion: 'no-drag',
        }}
      >
        <button
          type="button"
          aria-label="Свернуть"
          onClick={() => api.minimizeWindow()}
          style={{
            width: 46,
            height: TITLEBAR_H,
            border: 'none',
            background: 'transparent',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#e2e8f0'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
        >
          —
        </button>
        <button
          type="button"
          aria-label="Развернуть"
          onClick={() => api.maximizeWindow()}
          style={{
            width: 46,
            height: TITLEBAR_H,
            border: 'none',
            background: 'transparent',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#e2e8f0'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
        >
          □
        </button>
        <button
          type="button"
          aria-label="Закрыть"
          onClick={() => api.closeWindow()}
          style={{
            width: 46,
            height: TITLEBAR_H,
            border: 'none',
            background: 'transparent',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.9)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

export const DESKTOP_TITLEBAR_HEIGHT = TITLEBAR_H;
