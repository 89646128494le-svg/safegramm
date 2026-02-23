import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
    alias: [
      { find: /^zustand$/, replacement: path.resolve(__dirname, 'src/lib/zustand-shim.ts') },
      { find: 'zustand-original', replacement: path.resolve(__dirname, 'node_modules/zustand/esm/index.mjs') },
    ],
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
