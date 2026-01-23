import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { 
    port: 5173, 
    host: true 
  },
  build: {
    minify: 'esbuild',
    sourcemap: process.env.NODE_ENV === 'development', // Source maps только в dev
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
    chunkSizeWarningLimit: 1000,
    // В production удаляем console.log
    ...(process.env.NODE_ENV === 'production' && {
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true
        }
      }
    })
  }
});
