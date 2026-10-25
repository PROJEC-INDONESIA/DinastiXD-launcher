const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dinasti', {
  getStatus: () => ipcRenderer.invoke('launcher:get-status'),
  openMinecraftFolder: () => ipcRenderer.invoke('launcher:open-minecraft-folder'),
  getVersions: () => ipcRenderer.invoke('launcher:get-versions'),
  getAccount: () => ipcRenderer.invoke('launcher:get-account'),
  isVersionInstalled: (version) => ipcRenderer.invoke('launcher:version-installed', version),
  installVersion: (version) => ipcRenderer.invoke('launcher:install-version', version),
  loginMicrosoft: () => ipcRenderer.invoke('launcher:login-microsoft'),
  logoutMicrosoft: () => ipcRenderer.invoke('launcher:logout-microsoft'),
  launchGame: (version) => ipcRenderer.invoke('launcher:launch-game', version),
  listMinecraftDirectory: (relativePath) => ipcRenderer.invoke('launcher:list-files', relativePath),
  readMinecraftTextFile: (relativePath) => ipcRenderer.invoke('launcher:read-text-file', relativePath),
  onProgress: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('launcher:progress', listener);
    return () => ipcRenderer.removeListener('launcher:progress', listener);
  }
});