// ============================================================
//  Contrôle Gasoil — application desktop (Electron)
//  Charge l'interface web construite (dist/) dans une fenêtre
//  native. Les données restent dans Supabase (appels HTTPS),
//  donc rien n'est stocké en local hormis la session de connexion.
// ============================================================
const { app, BrowserWindow, shell } = require('electron')
const path = require('node:path')

const isDev = !!process.env.VITE_DEV_SERVER_URL

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#f8fafc',
    title: 'Contrôle Gasoil',
    icon: path.join(__dirname, '..', 'public', 'icons', 'icon-512.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.removeMenu()

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  // Ouvre les liens externes (tickets, docs) dans le navigateur système.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
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
