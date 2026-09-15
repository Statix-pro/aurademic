import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const includeIisConfiguration = () => ({
  name: 'include-iis-configuration',
  async closeBundle() {
    await copyFile(
      resolve(process.cwd(), '..', 'web.config'),
      resolve(process.cwd(), 'dist', 'web.config'),
    );
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), includeIisConfiguration()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
