import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_PREVIEW=1 → build « aperçu » : vitrine seule, un seul fichier JS/CSS
// (dynamic imports inlinés) pour produire un HTML autonome partageable.
const preview = !!process.env.VITE_PREVIEW

export default defineConfig({
  plugins: [react()],
  ...(preview
    ? {
        build: {
          outDir: 'dist-preview',
          cssCodeSplit: false,
          assetsInlineLimit: 100000000,
          rollupOptions: {
            input: 'index.preview.html',
            output: { inlineDynamicImports: true },
          },
        },
      }
    : {}),
})
