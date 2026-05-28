import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Cloudflare Pages build. The API URL is read from VITE_API_BASE at build
// time; if unset (e.g. `npm run dev`), we fall back to a Vite proxy to a
// locally-running `wrangler dev`.

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          { urlPattern: /\/api\//, handler: 'NetworkFirst',
            options: { cacheName: 'api', networkTimeoutSeconds: 5 } },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: true }, // wrangler dev
    },
  },
});
