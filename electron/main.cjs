// ============================================================
//  DTS Operation ERP — Application desktop (Electron)
//  Ouvre l'interface (build Vite dans ../dist) dans une fenêtre
//  native, installable sur Windows / macOS / Linux.
//  Les données restent dans Supabase (connexion Internet requise).
// ============================================================
const { app, BrowserWindow, shell } = require('electron')
const path = require('path')

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'DTS Operation ERP',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.setMenuBarVisibility(false)
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))

  // Les liens externes (supabase.com, etc.) s'ouvrent dans le navigateur.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
