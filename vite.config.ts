import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Build desktop (Electron) : chemins relatifs pour file:// et pas de PWA.
const isElectron = process.env.ELECTRON === '1'

// https://vite.dev/config/
export default defineConfig({
  base: isElectron ? './' : '/',
  plugins: [
    react(),
    ...(isElectron
      ? []
      : [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon-64.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Contrôle Gasoil — DTS',
        short_name: 'Contrôle Gasoil',
        description:
          'Suivi de la consommation gasoil/essence, AdBlue et rentabilité du parc roulant.',
        lang: 'fr',
        theme_color: '#1e3a8a',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Coquille de l'app en cache (offline) ; les appels Supabase restent réseau.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//, /^\/storage\//],
      },
    }),
        ]),
  ],
})
