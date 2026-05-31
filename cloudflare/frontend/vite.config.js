import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Cloudflare Pages build.

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // injectManifest lets us own the service worker source. We add web
      // push + notificationclick handlers on top of Workbox precaching.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Tsundoku',
        short_name: 'Tsundoku',
        description: 'Quiet feed of long-form reading across the few sources you trust.',
        theme_color: '#1A1614',
        background_color: '#1A1614',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icon-dark-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-dark-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-dark-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
});
