const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  
  // Window state listener
  onWindowStateChanged: (callback) => {
    ipcRenderer.on('window-state-changed', (event, state) => callback(state));
  },
  
  // Check if running in Electron
  isElectron: true,
});
