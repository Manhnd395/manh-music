// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';
import globby from 'globby';

export default defineConfig(async () => {
  const htmlFiles = await globby('public/**/*.html');

  const input = htmlFiles.reduce((acc, file) => {
    const key = file.replace('public/', '').replace('.html', '');
    acc[key] = resolve(__dirname, file);
    return acc;
  }, {});

  return {
    root: 'public',
    envDir: '..',
    base: '/',
    server: {
      host: '0.0.0.0',
      port: 8080,
      strictPort: true,
    },
    build: {
      outDir: '../dist',
      rollupOptions: {
        input,
      },
    },
  };
});