const { app, BrowserWindow, ipcMain, safeStorage, shell } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Auth } = require('msmc');
const { authenticateEly, invalidateEly, validateEly } = require('./ely-auth');
const { resolveInsideRoot } = require('./minecraft-path');
const {
  installCurseForgeProject,
  installCurseForgeResource,
  installModrinthResource,
  installModrinthProject,
  searchCurseForgeContent,
  searchModrinthContent
} = require('./mod-platforms');
const {
  installOfficialVersion,
  installSelectedVersion,
  launchOfficialVersion,
  listLoaderVersions,
  listOfficialVersions
} = require('./minecraft-service');

let minecraftAccount;

function getMinecraftDirectory() {
  return path.join(app.getPath('appData'), '.minecraft');
}

function getInstanceKey({ minecraftVersion, loader = 'Vanilla', loaderVersion = '' }) {
  return JSON.stringify([minecraftVersion, loader, loaderVersion]);
}

function getInstanceDirectory(selection) {
  if ((selection.loader || 'Vanilla') === 'Vanilla') return getMinecraftDirectory();
  const id = crypto.createHash('sha256').update(getInstanceKey(selection)).digest('hex').slice(0, 12);
  const name = `${selection.minecraftVersion}-${selection.loader.toLowerCase()}-${selection.loaderVersion}`.replace(/[^a-zA-Z0-9.-]/g, '_');
  return path.join(getMinecraftDirectory(), 'dinastixd-instances', `${name}-${id}`);
}

async function getInstalledInstances() {
  try {
    return JSON.parse(await fs.readFile(path.join(app.getPath('userData'), 'instances.json'), 'utf8'));
  } catch {
    return {};
  }
}

async function saveInstalledInstance(selection, installedVersion) {
  const instances = await getInstalledInstances();
  instances[getInstanceKey(selection)] = installedVersion;
  const file = path.join(app.getPath('userData'), 'instances.json');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(instances, null, 2), 'utf8');
}

function getCurseForgeKeyPath() {
  return path.join(app.getPath('userData'), 'curseforge-key.bin');
}

async function getCurseForgeKey() {
  try {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Penyimpanan terenkripsi OS tidak tersedia.');
    const encrypted = await fs.readFile(getCurseForgeKeyPath());
    return safeStorage.decryptString(encrypted);
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
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
ipcMain.handle('launcher:get-loader-versions', async (_event, minecraftVersion, loader) => {
  return listLoaderVersions(minecraftVersion, loader);
});
ipcMain.handle('launcher:search-content', async (_event, { source, query, selection, contentType = 'mod' }) => {
  if (source === 'Modrinth') return searchModrinthContent(query, selection, contentType);
  if (source === 'CurseForge') return searchCurseForgeContent(query, selection, await getCurseForgeKey(), contentType);
  throw new Error('Sumber mod tidak dikenal.');
});
ipcMain.handle('launcher:install-content', async (_event, { source, id, selection, contentType = 'mod' }) => {
  if (!selection) throw new Error('Pilih instance Minecraft terlebih dahulu.');
  if (contentType === 'mod' && selection.loader === 'Vanilla') {
    throw new Error('Pilih dan pasang Fabric, Forge, atau NeoForge sebelum memasang mod.');
  }
  const instanceDirectory = getInstanceDirectory(selection);
  const contentDirectory = {
    mod: 'mods',
    resourcepack: 'resourcepacks',
    shader: 'shaderpacks'
  }[contentType];
  if (!contentDirectory) throw new Error('Jenis konten belum didukung.');
  const directory = path.join(instanceDirectory, contentDirectory);
  await fs.mkdir(directory, { recursive: true });
  const safeDirectory = await resolveInsideRoot(instanceDirectory, contentDirectory);
  if (source === 'Modrinth') {
    return contentType === 'mod'
      ? installModrinthProject(id, selection, safeDirectory)
      : installModrinthResource(id, selection, safeDirectory, contentType);
  }
  if (source === 'CurseForge') {
    const key = await getCurseForgeKey();
    return contentType === 'mod'
      ? installCurseForgeProject(id, selection, safeDirectory, key)
      : installCurseForgeResource(id, selection, safeDirectory, key, contentType);
  }
  throw new Error('Sumber mod tidak dikenal.');
});
ipcMain.handle('launcher:curseforge-key-status', async () => Boolean(await getCurseForgeKey()));
ipcMain.handle('launcher:save-curseforge-key', async (_event, apiKey) => {
  if (typeof apiKey !== 'string' || apiKey.trim().length < 20) throw new Error('API key CurseForge tidak valid.');
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Penyimpanan terenkripsi OS tidak tersedia.');
  const file = getCurseForgeKeyPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, safeStorage.encryptString(apiKey.trim()), { mode: 0o600 });
  return true;
});
ipcMain.handle('launcher:get-account', async () => minecraftAccount?.profile
  ? { name: minecraftAccount.profile.name, id: minecraftAccount.profile.id, provider: minecraftAccount.provider }
  : null);

ipcMain.handle('launcher:version-installed', async (_event, selection) => {
  const chosen = typeof selection === 'string' ? { minecraftVersion: selection, loader: 'Vanilla' } : selection;
  const instances = await getInstalledInstances();
  const instanceVersion = instances[getInstanceKey(chosen)] || chosen.minecraftVersion;
  const versionDirectory = path.join(getInstanceDirectory(chosen), 'versions', instanceVersion);
  try {
    await fs.access(path.join(versionDirectory, `${instanceVersion}.json`));
    if ((chosen.loader || 'Vanilla') === 'Vanilla') await fs.access(path.join(versionDirectory, `${instanceVersion}.jar`));
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('launcher:install-version', async (event, selection) => {
  const { minecraftVersion, loader = 'Vanilla', loaderVersion = '' } = selection;
  event.sender.send('launcher:progress', { stage: 'install', message: `Menyiapkan Minecraft ${minecraftVersion}...` });
  try {
    const result = await installSelectedVersion(getInstanceDirectory(selection), minecraftVersion, loader, loaderVersion, (message) => {
      event.sender.send('launcher:progress', { stage: 'install', message });
    });
    await saveInstalledInstance(selection, result.version);
    event.sender.send('launcher:progress', { stage: 'installed', message: `${loader} ${loaderVersion || minecraftVersion} siap dimainkan.` });
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
  minecraftAccount.provider = 'Microsoft';
  return { name: account.profile.name, id: account.profile.id };
});

ipcMain.handle('launcher:login-ely', async (_event, { username, password, twoFactorToken }) => {
  minecraftAccount = await authenticateEly(username, password, twoFactorToken);
  return { name: minecraftAccount.profile.name, id: minecraftAccount.profile.id, provider: minecraftAccount.provider };
});

ipcMain.handle('launcher:logout-microsoft', async () => {
  if (minecraftAccount?.provider === 'Ely.by') await invalidateEly(minecraftAccount);
  minecraftAccount = undefined;
});

ipcMain.handle('launcher:launch-game', async (event, selection) => {
  if (!minecraftAccount) throw new Error('Login Microsoft terlebih dahulu.');
  if (minecraftAccount.provider === 'Ely.by') {
    if (!await validateEly(minecraftAccount)) throw new Error('Sesi Ely.by kedaluwarsa. Login kembali sebelum bermain.');
  } else if (!minecraftAccount.validate()) {
    minecraftAccount = await minecraftAccount.refresh();
  }

  const instances = await getInstalledInstances();
  const versionId = instances[getInstanceKey(selection)] || selection.minecraftVersion;
  event.sender.send('launcher:progress', { stage: 'launch', message: `Menjalankan Minecraft ${versionId}...` });
  const { child, javaMajor } = await launchOfficialVersion({
    gameDirectory: getInstanceDirectory(selection),
    versionId,
    account: minecraftAccount,
    onStatus: (message) => event.sender.send('launcher:progress', { stage: 'launch', message })
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