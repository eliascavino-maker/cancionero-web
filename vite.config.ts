/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // Service worker: the app and its fonts keep working without internet.
    VitePWA({
      // A new version waits for the user to accept it, so the page never
      // reloads in the middle of a show.
      registerType: 'prompt',
      injectRegister: false,
      // public/manifest.webmanifest is the manifest; the plugin doesn't write one.
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  // Relative paths so the build works from any folder (GitHub Pages, etc.).
  base: './',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
