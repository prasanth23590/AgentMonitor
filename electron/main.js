const { app, BrowserWindow, dialog, ipcMain, screen, shell } = require('electron')
const fs = require('fs')
const path = require('path')
const { resolveBounds, MIN_WIDTH, MIN_HEIGHT } = require('./bounds')
const { isSameOrigin } = require('./origin')

// `npm run app` passes --dev: load the Vite dev server instead of starting our own server.
const DEV = process.argv.includes('--dev')
const DEV_URL = 'http://localhost:5173/'

let win = null
let server = null
let origin = ''

const boundsFile = () => path.join(app.getPath('userData'), 'window.json')

function loadSaved() {
  try { return JSON.parse(fs.readFileSync(boundsFile(), 'utf8')) } catch { return null }
}

function saveBounds() {
  if (!win || win.isDestroyed()) return
  try {
    fs.writeFileSync(boundsFile(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() }))
  } catch { /* best effort */ }
}

const isWeb = url => /^https?:/i.test(url)

function createWindow(url) {
  const saved = loadSaved()
  const bounds = resolveBounds(saved, screen.getAllDisplays())
  origin = new URL(url).origin

  win = new BrowserWindow({
    ...bounds,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    backgroundColor: '#0D0818',
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    title: 'Agent Monitor',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.removeMenu()
  if (saved && saved.maximized) win.maximize()

  // Links that leave the app open in the default browser; nothing else may navigate the window.
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (isWeb(target)) shell.openExternal(target)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, target) => {
    if (isSameOrigin(target, origin)) return
    event.preventDefault()
    if (isWeb(target)) shell.openExternal(target)
  })
  // a same-origin page must not be able to redirect the window somewhere else either
  win.webContents.on('will-redirect', (event, target) => {
    if (!isSameOrigin(target, origin)) event.preventDefault()
  })

  win.on('close', saveBounds)
  win.loadURL(url)
}

async function main() {
  if (DEV) return createWindow(DEV_URL)
  try {
    const { start } = require('../server')
    server = await start({ port: 0, staticDir: path.join(__dirname, '..', 'dist') })
  } catch (err) {
    dialog.showErrorBox('Agent Monitor could not start', String((err && err.stack) || err))
    app.quit()
    return
  }
  createWindow(`http://127.0.0.1:${server.port}/`)
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })
  ipcMain.on('quit', event => {
    // only our own UI may quit the app
    if (origin && event.senderFrame && isSameOrigin(event.senderFrame.url, origin)) app.quit()
  })
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', () => {
    if (server) { server.close(); server = null }
  })
  app.whenReady().then(main)
}
