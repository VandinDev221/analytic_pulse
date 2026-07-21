import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@analytic-pulse/shared': path.resolve(rootDir, '../../packages/shared/src'),
      '@analytic-pulse/ui/styles.css': path.resolve(
        rootDir,
        '../../packages/ui/src/styles.css'
      ),
      '@analytic-pulse/ui': path.resolve(rootDir, '../../packages/ui/src'),
    },
  },
  server: {
    port: 5173,
    fs: {
      allow: [path.resolve(rootDir, '../..')],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
