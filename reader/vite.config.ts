import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [react()],
  server: { host: '127.0.0.1', watch: {
    // Generated JSON is fetched on demand. Exclude asset trees from HMR to avoid
    // Windows directory handles blocking a build/sync while dev is running.
    ignored: [/(?:^|[\\/])public[\\/](?:content|content-staging|dictionary)(?:[\\/]|$)/],
  } },
  preview: { host: '127.0.0.1' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    unstubGlobals: true,
  },
});
