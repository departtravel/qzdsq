// Préchargement minimal. Le contexte est isolé (contextIsolation) ;
// on expose seulement quelques infos utiles, sans accès Node à la page.
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  platform: process.platform,
})
