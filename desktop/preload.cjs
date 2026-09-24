const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('reposcopeDesktop', {
  chooseRepository: () => ipcRenderer.invoke('choose-repository'),
});
