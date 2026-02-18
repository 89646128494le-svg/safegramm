/**
 * SafeGram Desktop - Renderer Process Entry Point
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

// Инициализация приложения
const root = document.getElementById('root')!;
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
if (typeof window !== 'undefined') (window as any).__safeGramAppMounted = true;
