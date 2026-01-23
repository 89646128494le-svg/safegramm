import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Production оптимизации
    minify: 'esbuild',
    sourcemap: false, // Отключаем source maps в production для безопасности
    rollupOptions: {
      output: {
        // Разделение кода для лучшего кэширования
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['framer-motion', 'lucide-react'],
          'utils-vendor': ['zustand', '@tanstack/react-query']
        }
      }
    },
    // Увеличиваем лимит предупреждений
    chunkSizeWarningLimit: 1000,
    // Оптимизация для production
    terserOptions: {
      compress: {
        drop_console: true, // Удаляем console.log в production
        drop_debugger: true
      }
    }
  },
  // Оптимизация dev сервера (не влияет на production build)
  server: {
    port: 5173,
    host: true
  },
  // Оптимизация preview сервера
  preview: {
    port: 4173,
    host: true
  }
});
