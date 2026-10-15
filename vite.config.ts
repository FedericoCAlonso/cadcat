/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { createPwaManifest } from './src/pwaConfig';

export default defineConfig(({ mode }) => {
  const base = mode === 'production' ? '/mobilius/' : '/';

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: createPwaManifest(base),
        workbox: {
          cacheId: 'mobilius',
          globPatterns: ['**/*.{js,css,html,svg,json,png}'],
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    test: {
      globals: true,
      environment: 'jsdom',
    },
  };
});
