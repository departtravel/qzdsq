import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // base relative : le build fonctionne quel que soit l'hébergement
  // (Netlify Drop, sous-dossier, etc.).
  base: './',
  plugins: [react()],
})
