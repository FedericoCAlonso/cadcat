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
        includeAssets: [
          'icon.svg',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'favicon.ico',
          'icons/mobilius-icon-dark.svg',
          'icons/mobilius-icon-light.svg',
          'icons/icon-192.png',
          'icons/icon-512.png',
          'icons/icon-512-maskable.png',
          'icons/apple-touch-icon.png',
          'icons/favicon.ico',
          'icons/favicon-32.png',
          'icons/favicon-64.png',
          'icons/icon-light-192.png',
          'icons/icon-light-512.png',
        ],
        manifest: createPwaManifest(base),
        workbox: {
          cacheId: 'mobilius',
          globPatterns: ['**/*.{js,css,html,svg,json,png,ico}'],
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
