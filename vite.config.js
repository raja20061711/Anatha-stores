import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: false,
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
      '/product-images': {
        target: process.env.VITE_BACKEND_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  define: {
    'process.env': {},
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
