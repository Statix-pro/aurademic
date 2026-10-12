import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pins notification/push env before any test file imports the app, so the
    // suite does not vary with a developer's local .env. See vitest.setup.js.
    setupFiles: ['./vitest.setup.js'],
  },
});
