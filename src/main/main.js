const fs = require('fs')
const path = require('path')
const { app, BrowserWindow, ipcMain, shell } = require('electron')
const config = require('../../launcher.config.json')
const paths = require('./paths')
const settings = require('./settings')
const auth = require('./auth')
const game = require('./game')

// AEGIS_HIDDEN=1 : la fenêtre n'est jamais affichée (tests automatisés).
const hidden = Boolean(process.env.AEGIS_HIDDEN)

let window = null
let restoring = null
let busy = false

function send(channel, payload) {
  if (window && !window.isDestroyed()) window.webContents.send(channel, payload)
}

function show() {
  if (!hidden && window && !window.isDestroyed()) window.show()
}

function log(error) {
  fs.mkdirSync(paths.root, { recursive: true })
  fs.appendFileSync(path.join(paths.root, 'launcher.log'), `${new Date().toISOString()} ${error?.stack || error}\n`)
}

function createWindow() {
  window = new BrowserWindow({
    width: 1080,
    height: 640,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    show: false,
    backgroundColor: '#17121c',
    title: `${config.name} Launcher`,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // Une fenêtre jamais affichée ne produit aucune image : le rendu hors écran permet les captures.
      offscreen: hidden
    }
  })
  window.loadFile(path.join(__dirname, '../renderer/index.html'))
  window.once('ready-to-show', show)
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
}

async function play() {
  if (busy) return
  busy = true
  send('status', { phase: 'preparing' })
  try {
    const session = await auth.session()
    if (!session) throw new Error('Session expirée')
    const prepared = await game.prepare(config, (progress) => send('progress', progress))
    send('progress', { label: 'Lancement du jeu', ratio: 1 })
    const watcher = await game.start(config, settings.read(), session, prepared)
    watcher.on('minecraft-window-ready', () => {
      send('status', { phase: 'running' })
      window.hide()
    })
    watcher.on('minecraft-exit', ({ code }) => {
      busy = false
      show()
      send('status', { phase: 'idle', error: code ? 'Le jeu s’est arrêté de façon inattendue.' : undefined })
    })
    watcher.on('error', (error) => {
      log(error)
      busy = false
      send('status', { phase: 'idle', error: 'Le jeu n’a pas pu démarrer.' })
    })
  } catch (error) {
    log(error)
    busy = false
    send('status', { phase: 'idle', error: 'Installation interrompue. Vérifiez la connexion, puis réessayez.' })
  }
}

ipcMain.handle('state', async () => ({
  name: config.name,
  tagline: config.tagline,
  minecraft: config.minecraft,
  forge: config.forge,
  links: config.links,
  version: app.getVersion(),
  settings: settings.read(),
  ram: { min: settings.ramMin, max: settings.ramMax },
  account: await restoring
}))
ipcMain.handle('login', () => auth.login())
ipcMain.handle('logout', () => auth.logout())
ipcMain.handle('play', () => void play())
ipcMain.handle('settings', (_event, patch) => settings.write({ ram: patch.ram }))
ipcMain.handle('open', (_event, target) => {
  if (target === 'game') {
    fs.mkdirSync(paths.game, { recursive: true })
    return shell.openPath(paths.game)
  }
  const url = config.links[target]
  if (typeof url === 'string' && url.startsWith('https://')) return shell.openExternal(url)
})
ipcMain.handle('window', (_event, action) => {
  if (action === 'minimize') window.minimize()
  if (action === 'close') window.close()
})

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (window.isMinimized()) window.restore()
    show()
    window.focus()
  })
  app.whenReady().then(() => {
    restoring = auth.restore()
    createWindow()
  })
  app.on('window-all-closed', () => app.quit())
}
