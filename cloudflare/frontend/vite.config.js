import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { extensionZip } from './vite-plugin-extension-zip.js';

// Cloudflare Pages build.

export default defineConfig({
  // Build timestamp surfaced in Settings → About (and useful for support).
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(new Date().toISOString().slice(0, 19) + 'Z'),
  },
  plugins: [
    react(),
    // Emit the extension download (tsundoku-extension.zip) + version json into
    // the build output. Pure JS so it works on any build host (no `zip` binary).
    extensionZip(),
    VitePWA({
      // 'prompt' so a new deploy surfaces the update toast instead of silently
      // reloading; main.jsx wires onNeedRefresh → window event → UpdateToast.
      registerType: 'prompt',
      // We register the SW ourselves in main.jsx (registerSW from
      // virtual:pwa-register) — don't let the plugin inject a second one.
      injectRegister: null,
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
