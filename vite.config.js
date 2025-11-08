// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'public',           // GIỮ NGUYÊN: public là root
  envDir: '..',             // TÌM .env Ở THƯ MỤC CHA (root project)
  server: {
    host: '0.0.0.0',
    port: 8080,
    strictPort: true,
  },
  build: {
    outDir: '../dist',
  },
});