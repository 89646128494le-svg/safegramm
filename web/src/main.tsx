import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { queryClient } from './services/queryClient';
import { loadApiConfig } from './services/api';
import { i18n } from './i18n';
import './styles.css';
import './styles/mobile.css';

i18n.setLocale(i18n.getLocale());

// Загружаем config.json (apiUrl) перед первым рендером — для деплоя на Vercel при API на своём ПК
loadApiConfig().then(() => {
  createRoot(document.getElementById('root')!).render(
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
});
