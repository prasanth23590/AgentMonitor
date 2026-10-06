// Exposes the single capability the UI needs from the desktop shell.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('agentMonitor', {
  quit: () => ipcRenderer.send('quit'),
})
