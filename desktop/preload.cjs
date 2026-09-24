const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('reposcopeDesktop', {
  chooseRepository: () => ipcRenderer.invoke('choose-repository'),
  // Synchronous, so the saved theme is known before the page first paints.
  settings: ipcRenderer.sendSync('read-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
});
