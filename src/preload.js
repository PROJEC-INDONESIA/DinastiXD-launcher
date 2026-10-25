const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dinasti', {
  getStatus: () => ipcRenderer.invoke('launcher:get-status'),
  openMinecraftFolder: () => ipcRenderer.invoke('launcher:open-minecraft-folder'),
  listMinecraftDirectory: (relativePath) => ipcRenderer.invoke('launcher:list-files', relativePath),
  readMinecraftTextFile: (relativePath) => ipcRenderer.invoke('launcher:read-text-file', relativePath)
});