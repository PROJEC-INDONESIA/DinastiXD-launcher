const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Auth } = require('msmc');
const { resolveInsideRoot } = require('./minecraft-path');
const {
  installOfficialVersion,
  launchOfficialVersion,
  listOfficialVersions
} = require('./minecraft-service');

let minecraftAccount;

function getMinecraftDirectory() {
  return path.join(app.getPath('appData'), '.minecraft');
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#10140f',
    title: 'DinastiXD Launcher',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  await window.loadFile(path.join(__dirname, 'index.html'));
}

ipcMain.handle('launcher:get-status', async () => {
  const minecraftDirectory = getMinecraftDirectory();
  let folderExists = false;

  try {
    await fs.access(minecraftDirectory);
    folderExists = true;
  } catch {
    // The folder is created by Minecraft or the user, not by the dashboard.
  }

  return { minecraftDirectory, folderExists, platform: process.platform };
});

ipcMain.handle('launcher:open-minecraft-folder', async () => {
  const minecraftDirectory = getMinecraftDirectory();
  await fs.mkdir(minecraftDirectory, { recursive: true });
  return shell.openPath(minecraftDirectory);
});

ipcMain.handle('launcher:get-versions', async () => listOfficialVersions());
ipcMain.handle('launcher:get-account', async () => minecraftAccount?.profile
  ? { name: minecraftAccount.profile.name, id: minecraftAccount.profile.id }
  : null);

ipcMain.handle('launcher:version-installed', async (_event, versionId) => {
  const versionDirectory = path.join(getMinecraftDirectory(), 'versions', versionId);
  try {
    await Promise.all([
      fs.access(path.join(versionDirectory, `${versionId}.json`)),
      fs.access(path.join(versionDirectory, `${versionId}.jar`))
    ]);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('launcher:install-version', async (event, versionId) => {
  event.sender.send('launcher:progress', { stage: 'install', message: `Menyiapkan Minecraft ${versionId}...` });
  try {
    const result = await installOfficialVersion(getMinecraftDirectory(), versionId, (message) => {
      event.sender.send('launcher:progress', { stage: 'install', message });
    });
    event.sender.send('launcher:progress', { stage: 'installed', message: `Minecraft ${result.version} siap dimainkan.` });
    return result;
  } catch (error) {
    event.sender.send('launcher:progress', { stage: 'error', message: error.message });
    throw error;
  }
});

ipcMain.handle('launcher:login-microsoft', async () => {
  const auth = new Auth('select_account');
  const xbox = await auth.launch('electron', { width: 520, height: 700, resizable: false });
  const account = await xbox.getMinecraft();
  const entitlements = await account.entitlements();
  const ownsJava = entitlements.includes('game_minecraft') || entitlements.includes('product_minecraft');

  if (!account.profile || !ownsJava) {
    throw new Error('Akun Microsoft ini tidak memiliki Minecraft Java Edition.');
  }

  minecraftAccount = account;
  return { name: account.profile.name, id: account.profile.id };
});

ipcMain.handle('launcher:logout-microsoft', async () => {
  minecraftAccount = undefined;
});

ipcMain.handle('launcher:launch-game', async (event, versionId) => {
  if (!minecraftAccount) throw new Error('Login Microsoft terlebih dahulu.');
  if (!minecraftAccount.validate()) minecraftAccount = await minecraftAccount.refresh();

  event.sender.send('launcher:progress', { stage: 'launch', message: `Menjalankan Minecraft ${versionId}...` });
  const { child, javaMajor } = await launchOfficialVersion({
    gameDirectory: getMinecraftDirectory(),
    versionId,
    account: minecraftAccount
  });

  child.once('error', (error) => {
    if (!event.sender.isDestroyed()) event.sender.send('launcher:progress', { stage: 'error', message: error.message });
  });
  child.once('exit', (code) => {
    if (!event.sender.isDestroyed()) event.sender.send('launcher:progress', {
      stage: 'game-exit',
      message: code === 0 ? 'Minecraft ditutup.' : `Minecraft berhenti dengan kode ${code}.`
    });
  });

  event.sender.send('launcher:progress', { stage: 'playing', message: `Game dimulai dengan Java ${javaMajor}.` });
  return { started: true, javaMajor };
});

ipcMain.handle('launcher:list-files', async (_event, relativeDirectory = '') => {
  let directory;
  try {
    directory = await resolveInsideRoot(getMinecraftDirectory(), relativeDirectory);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  let entries;

  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const items = await Promise.all(entries.filter((entry) => !entry.isSymbolicLink()).map(async (entry) => {
    const itemPath = path.join(directory, entry.name);
    const stats = await fs.stat(itemPath);
    return {
      name: entry.name,
      directory: entry.isDirectory(),
      size: stats.size,
      modified: stats.mtime.toISOString()
    };
  }));

  return items.sort((first, second) => Number(second.directory) - Number(first.directory) || first.name.localeCompare(second.name));
});

ipcMain.handle('launcher:read-text-file', async (_event, relativeFile = '') => {
  const file = await resolveInsideRoot(getMinecraftDirectory(), relativeFile);
  const stats = await fs.lstat(file);
  const textExtensions = new Set(['.cfg', '.json', '.json5', '.log', '.mcmeta', '.md', '.properties', '.txt', '.toml', '.yaml', '.yml']);

  if (!stats.isFile() || stats.isSymbolicLink() || !textExtensions.has(path.extname(file).toLowerCase())) {
    throw new Error('Pratinjau hanya tersedia untuk file teks yang didukung.');
  }
  if (stats.size > 1024 * 1024) throw new Error('File terlalu besar untuk pratinjau (maksimal 1 MB).');

  const contents = await fs.readFile(file, 'utf8');
  if (contents.includes('\0')) throw new Error('File ini bukan teks yang dapat dipratinjau.');
  return contents;
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});