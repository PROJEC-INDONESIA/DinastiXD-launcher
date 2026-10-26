const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dinasti', {
  getStatus: () => ipcRenderer.invoke('launcher:get-status'),
  openMinecraftFolder: () => ipcRenderer.invoke('launcher:open-minecraft-folder'),
  getVersions: () => ipcRenderer.invoke('launcher:get-versions'),
  getLoaderVersions: (minecraftVersion, loader) => ipcRenderer.invoke('launcher:get-loader-versions', minecraftVersion, loader),
  searchContent: (source, query, selection, contentType) => ipcRenderer.invoke('launcher:search-content', { source, query, selection, contentType }),
  installContent: (source, id, selection, contentType) => ipcRenderer.invoke('launcher:install-content', { source, id, selection, contentType }),
  curseForgeKeyStatus: () => ipcRenderer.invoke('launcher:curseforge-key-status'),
  saveCurseForgeKey: (apiKey) => ipcRenderer.invoke('launcher:save-curseforge-key', apiKey),
  getAccount: () => ipcRenderer.invoke('launcher:get-account'),
  isVersionInstalled: (selection) => ipcRenderer.invoke('launcher:version-installed', selection),
  installVersion: (selection) => ipcRenderer.invoke('launcher:install-version', selection),
  loginMicrosoft: () => ipcRenderer.invoke('launcher:login-microsoft'),
  loginEly: (credentials) => ipcRenderer.invoke('launcher:login-ely', credentials),
  logoutMicrosoft: () => ipcRenderer.invoke('launcher:logout-microsoft'),
  launchGame: (selection) => ipcRenderer.invoke('launcher:launch-game', selection),
  listMinecraftDirectory: (relativePath) => ipcRenderer.invoke('launcher:list-files', relativePath),
  readMinecraftTextFile: (relativePath) => ipcRenderer.invoke('launcher:read-text-file', relativePath),
  onProgress: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('launcher:progress', listener);
    return () => ipcRenderer.removeListener('launcher:progress', listener);
  }
});