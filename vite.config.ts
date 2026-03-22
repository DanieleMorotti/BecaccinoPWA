import tailwindcss from '@tailwindcss/vite';
import path from 'path'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import react from '@vitejs/plugin-react'

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  base: '/BecaccinoPWA/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,  // to make it work in npm run dev
      },
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,ico}'],
        globIgnores: ['**/icon.png'],
      },
      manifest: {
        name: 'Becaccino PWA',
        short_name: 'Becaccino',
        description: 'A multiplayer progressive web app for the card game Becaccino.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any'},
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable'},
        ],
      },
    }),
  ]
  ,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
