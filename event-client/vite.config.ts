import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 3000 belongs to the staff client; this app runs alongside it.
    port: 3001,
    // Fail instead of silently moving to 3002: only localhost:3001 is whitelisted
    // as a Google OAuth origin, so a drifted port breaks sign-in confusingly.
    strictPort: true,
    proxy: {
      // Same-origin /api in development mirrors production, where IIS rewrites
      // /api on the event subdomain to the shared Node backend.
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
