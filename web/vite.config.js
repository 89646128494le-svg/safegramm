import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  server: { 
    port: 5173, 
    host: true 
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'react-router-dom'],
    exclude: ['jspdf', 'jszip'],
  },
  build: {
    minify: 'esbuild',
    sourcemap: process.env.NODE_ENV === 'development',
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react/') || id.includes('react-router')) return 'react-vendor';
            if (id.includes('framer-motion') || id.includes('lucide-react')) return 'ui-vendor';
            if (id.includes('zustand') || id.includes('@tanstack/react-query')) return 'utils-vendor';
            if (id.includes('jspdf') || id.includes('jszip')) return 'pdf-zip';
          }
          if (id.includes('pages/AppShell') || id.includes('pages/chats')) return 'app-shell';
          if (id.includes('components/EnhancedChatWindow')) return 'chat-window';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    chunkSizeWarningLimit: 800,
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
