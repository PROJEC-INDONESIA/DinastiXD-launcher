const { Version, launch } = require('@xmcl/core');
const os = require('node:os');
const {
  getPotentialJavaLocations,
  getVersionList,
  install,
  resolveJava
} = require('@xmcl/installer');
const { installAdoptiumJava } = require('./java-runtime');

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

async function launchOfficialVersion({ gameDirectory, versionId, account }) {
  if (!account?.profile || !account.mcToken) {
    throw new Error('Login dengan akun Microsoft pemilik Minecraft Java Edition diperlukan.');
  }

  const resolved = await Version.parse(gameDirectory, versionId);
  const javaMajor = resolved.javaVersion?.majorVersion ?? getRequiredJavaMajor(versionId);
  let java = await findJava(javaMajor);
  if (!java) java = { path: await installAdoptiumJava(gameDirectory, javaMajor) };

  const child = await launch({
    gamePath: gameDirectory,
    javaPath: java.path,
    version: resolved,
    gameProfile: { name: account.profile.name, id: account.profile.id },
    accessToken: account.mcToken,
    userType: 'msa',
    maxMemory: Math.max(768, Math.min(process.arch === 'ia32' ? 1024 : 4096, Math.floor(os.totalmem() / 1024 / 1024 * 0.5))),
    minMemory: 512
  });

  return { child, javaMajor };
}

module.exports = {
  getRequiredJavaMajor,
  installOfficialVersion,
  launchOfficialVersion,
  listOfficialVersions
};