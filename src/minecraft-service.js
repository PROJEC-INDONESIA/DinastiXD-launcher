const { Version, launch } = require('@xmcl/core');
const os = require('node:os');
const {
  getFabricLoaderArtifact,
  getLoaderArtifactListFor,
  getPotentialJavaLocations,
  getVersionList,
  installFabric,
  installDependencies,
  installForge,
  installNeoForged,
  install,
  resolveJava
} = require('@xmcl/installer');
const { parse: parseForgePage } = require('@xmcl/forge-site-parser');
const { installAdoptiumJava } = require('./java-runtime');
const { ensureAuthlibInjector } = require('./ely-auth');

async function listOfficialVersions() {
  const manifest = await getVersionList();
  return {
    latest: manifest.latest.release,
    versions: manifest.versions.map(({ id, type, releaseTime }) => ({ id, type, releaseTime }))
  };
}

async function installOfficialVersion(gameDirectory, versionId, onStatus = () => {}) {
  const manifest = await getVersionList();
  const version = manifest.versions.find((entry) => entry.id === versionId);
  if (!version) throw new Error(`Versi Minecraft ${versionId} tidak ditemukan di manifest resmi.`);

  onStatus(`Mengunduh file resmi Minecraft ${versionId}...`);
  const resolved = await install(version, gameDirectory, {
    assetsDownloadConcurrency: 8,
    librariesDownloadConcurrency: 6
  });

  return {
    version: resolved.id,
    javaMajor: resolved.javaVersion?.majorVersion ?? getRequiredJavaMajor(versionId)
  };
}

async function getForgeVersions(minecraftVersion) {
  const response = await fetch(`https://files.minecraftforge.net/maven/net/minecraftforge/forge/index_${encodeURIComponent(minecraftVersion)}.html`);
  if (!response.ok) throw new Error(`Daftar Forge gagal dimuat (${response.status}).`);
  return parseForgePage(await response.text()).versions;
}

function compareVersionsDescending(first, second) {
  const a = first.split(/[.-]/).map((part) => Number(part) || 0);
  const b = second.split(/[.-]/).map((part) => Number(part) || 0);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (b[index] || 0) - (a[index] || 0);
  }
  return 0;
}

async function listLoaderVersions(minecraftVersion, loader) {
  if (loader === 'Vanilla') return [];
  if (loader === 'Fabric') {
    const artifacts = await getLoaderArtifactListFor(minecraftVersion);
    return artifacts.map((artifact) => ({
      id: artifact.loader.version,
      stable: artifact.loader.stable
    }));
  }
  if (loader === 'Forge') {
    const versions = await getForgeVersions(minecraftVersion);
    return versions.map((version) => ({ id: version.version, stable: version.type === 'recommended' }));
  }
  if (loader === 'NeoForge') {
    const [, minor, patch] = minecraftVersion.split('.').map(Number);
    const response = await fetch('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge');
    if (!response.ok) throw new Error(`Daftar NeoForge gagal dimuat (${response.status}).`);
    const { versions = [] } = await response.json();
    const prefix = `${minor}.${patch}.`;
    return versions.filter((version) => version.startsWith(prefix))
      .sort(compareVersionsDescending)
      .map((id) => ({ id, stable: true }));
  }
  throw new Error(`Loader ${loader} tidak didukung.`);
}

async function ensureJavaForVersion(gameDirectory, versionId, onStatus) {
  const resolved = await Version.parse(gameDirectory, versionId);
  const javaMajor = resolved.javaVersion?.majorVersion ?? getRequiredJavaMajor(versionId);
  const java = await findJava(javaMajor);
  if (java) return java.path;
  return installAdoptiumJava(gameDirectory, javaMajor, onStatus);
}

async function installLoaderVersion(gameDirectory, minecraftVersion, loader, loaderVersion, onStatus = () => {}) {
  if (loader === 'Vanilla') return minecraftVersion;
  if (!loaderVersion) throw new Error(`Pilih versi ${loader} terlebih dahulu.`);

  const available = await listLoaderVersions(minecraftVersion, loader);
  if (!available.some((version) => version.id === loaderVersion)) {
    throw new Error(`Versi ${loader} tidak cocok dengan Minecraft ${minecraftVersion}.`);
  }

  onStatus(`Memasang ${loader} ${loaderVersion}...`);
  if (loader === 'Fabric') {
    const artifact = await getFabricLoaderArtifact(minecraftVersion, loaderVersion);
    return installFabric({ minecraftVersion, version: artifact.loader.version, minecraft: gameDirectory });
  }

  const java = await ensureJavaForVersion(gameDirectory, minecraftVersion, onStatus);
  if (loader === 'Forge') {
    const forgeVersion = (await getForgeVersions(minecraftVersion)).find((version) => version.version === loaderVersion);
    if (!forgeVersion?.installer?.path) throw new Error('Installer Forge tidak ditemukan.');
    return installForge({
      mcversion: minecraftVersion,
      version: forgeVersion.version,
      installer: { path: forgeVersion.installer.path, sha1: forgeVersion.installer.sha1 }
    }, gameDirectory, { java, mavenHost: 'https://maven.minecraftforge.net' });
  }

  return installNeoForged('neoforge', loaderVersion, gameDirectory, {
    java,
    mavenHost: 'https://maven.neoforged.net/releases'
  });
}

async function installSelectedVersion(gameDirectory, minecraftVersion, loader, loaderVersion, onStatus = () => {}) {
  const vanilla = await installOfficialVersion(gameDirectory, minecraftVersion, onStatus);
  if (loader === 'Vanilla') return { ...vanilla, loader, loaderVersion: '' };
  const version = await installLoaderVersion(gameDirectory, minecraftVersion, loader, loaderVersion, onStatus);
  onStatus(`Mengunduh library ${loader}...`);
  await installDependencies(await Version.parse(gameDirectory, version));
  return { ...vanilla, version, loader, loaderVersion };
}

function getRequiredJavaMajor(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (major >= 26) return 25;
  if (major > 1 || minor >= 21 || minor === 20 && patch >= 5) return 21;
  if (major === 1 && minor === 17) return 16;
  if (minor >= 18) return 17;
  return 8;
}

async function findJava(requiredMajor) {
  const locations = await getPotentialJavaLocations();
  const results = await Promise.all(locations.map((location) => resolveJava(location)));
  const available = results.filter(Boolean);
  return available.find((java) => java.majorVersion === requiredMajor);
}

async function launchOfficialVersion({ gameDirectory, versionId, account, onStatus = () => {} }) {
  if (!account?.profile || !account.mcToken) {
    throw new Error('Login dengan akun Microsoft pemilik Minecraft Java Edition diperlukan.');
  }

  const resolved = await Version.parse(gameDirectory, versionId);
  const javaMajor = resolved.javaVersion?.majorVersion ?? getRequiredJavaMajor(versionId);
  onStatus(`Memeriksa library Minecraft ${versionId}...`);
  await installDependencies(resolved);
  onStatus(`Menyiapkan Java ${javaMajor}...`);
  const javaPath = await ensureJavaForVersion(gameDirectory, versionId);
  const yggdrasilAgent = account.provider === 'Ely.by'
    ? { jar: await ensureAuthlibInjector(gameDirectory), server: 'https://authserver.ely.by' }
    : undefined;

  const child = await launch({
    gamePath: gameDirectory,
    javaPath,
    version: resolved,
    gameProfile: { name: account.profile.name, id: account.profile.id },
    accessToken: account.mcToken,
    userType: account.provider === 'Ely.by' ? 'mojang' : 'msa',
    yggdrasilAgent,
    maxMemory: Math.max(768, Math.min(process.arch === 'ia32' ? 1024 : 4096, Math.floor(os.totalmem() / 1024 / 1024 * 0.5))),
    minMemory: 512
  });

  return { child, javaMajor };
}

module.exports = {
  getRequiredJavaMajor,
  installSelectedVersion,
  installOfficialVersion,
  listLoaderVersions,
  launchOfficialVersion,
  listOfficialVersions
};