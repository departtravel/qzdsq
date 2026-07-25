import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Build desktop (Electron) : chemins relatifs pour file:// et pas de PWA.
const isElectron = process.env.ELECTRON === '1'
// Build GitHub Pages : servi sous /qzdsq/ (nom du dépôt).
const isPages = process.env.PAGES === '1'
// Build mono-fichier : un seul index.html autonome, ouvrable en double-clic.
const isSingle = process.env.SINGLEFILE === '1'

// https://vite.dev/config/
export default defineConfig({
  base: isElectron || isSingle ? './' : isPages ? '/qzdsq/' : '/',
  plugins: [
    react(),
    ...(isSingle ? [viteSingleFile()] : []),
    ...(isElectron || isSingle
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
