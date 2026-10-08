const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('aegis', {
  state: () => ipcRenderer.invoke('state'),
  login: () => ipcRenderer.invoke('login'),
  logout: () => ipcRenderer.invoke('logout'),
  play: () => ipcRenderer.invoke('play'),
  saveSettings: (patch) => ipcRenderer.invoke('settings', patch),
  open: (target) => ipcRenderer.invoke('open', target),
  window: (action) => ipcRenderer.invoke('window', action),
  onProgress: (listener) => ipcRenderer.on('progress', (_event, progress) => listener(progress)),
  onStatus: (listener) => ipcRenderer.on('status', (_event, status) => listener(status))
})
