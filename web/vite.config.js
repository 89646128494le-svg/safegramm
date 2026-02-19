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
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    chunkSizeWarningLimit: 1200,
    ...(process.env.NODE_ENV === 'production' && {
      esbuild: { drop: ['console', 'debugger'] },
    }),
  },
});
