import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    // Generate source maps for production so the server can resolve minified
    // stack traces. 'hidden' = maps are created on disk but the bundles do NOT
    // contain a sourceMappingURL comment → maps stay private on the server.
    sourcemap: 'hidden',
  },
});
