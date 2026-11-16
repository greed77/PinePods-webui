/// <reference types="vitest/config" />
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // In dev, proxy API + websocket traffic to a real PinePods server so the app
  // can treat its own origin as the server (exactly like production).
  const target = env.PINEPODS_DEV_SERVER || 'http://localhost:8040';
  return {
    plugins: [sveltekit()],
    // Unit tests (npm test). Svelte's browser build is needed for runes in .svelte.ts modules.
    resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
    test: {
      include: ['src/**/*.test.ts'],
      environment: 'jsdom',
      setupFiles: ['src/test-setup.ts']
    },
    server: {
      proxy: {
        '/api': { target, changeOrigin: true },
        '/ws': { target, changeOrigin: true, ws: true }
      }
    }
  };
});
