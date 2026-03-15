import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { queryClient } from './services/queryClient';
import { loadApiConfig } from './services/api';
import { i18n } from './i18n';
import './styles.css';
import './styles/modern.css';
import './styles/mobile.css';
import './styles/responsive.css';

i18n.setLocale(i18n.getLocale());

// Конфиг API подгружается в фоне; первый рендер сразу — без ожидания config.json
loadApiConfig();

const root = document.getElementById('root');
if (root) {
  const isDesktop = typeof window !== 'undefined' && !!(window as any).electronAPI;
  const Router = isDesktop ? HashRouter : BrowserRouter;
  try {
    createRoot(root).render(
      <QueryClientProvider client={queryClient}>
        <Router
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <App />
        </Router>
      </QueryClientProvider>
    );
  } catch (error) {
    console.error('SafeGram bootstrap failed', error);
    root.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:linear-gradient(135deg,#0b1020 0%,#1a1f35 100%);color:#e2e8f0;font-family:system-ui">
        <div style="max-width:480px;text-align:center">
          <h1 style="margin:0 0 12px;font-size:24px">SafeGram</h1>
          <p style="margin:0 0 16px;color:#cbd5e1">Приложение не смогло запуститься в этом браузере.</p>
          <button onclick="location.reload()" style="padding:10px 18px;border:none;border-radius:10px;background:#7c6cff;color:#fff;cursor:pointer">Обновить</button>
        </div>
      </div>
    `;
  }
}
