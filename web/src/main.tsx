import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
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
  createRoot(root).render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
