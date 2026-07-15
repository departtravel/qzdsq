import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // base relatif => le build fonctionne aussi bien en hébergement web
  // qu'ouvert en local (file://) par l'application desktop Electron.
  base: './',
  plugins: [react()],
})
