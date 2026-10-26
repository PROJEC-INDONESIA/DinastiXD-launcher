const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createWriteStream } = require('node:fs');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const MODRINTH_API = 'https://api.modrinth.com/v2';
const CURSEFORGE_API = 'https://api.curseforge.com/v1';
const CURSEFORGE_GAME_ID = 432;
const CURSEFORGE_CLASS_ID = { mod: 6, modpack: 4471, resourcepack: 12, shader: 6552 };
const CURSEFORGE_LOADER_ID = { Vanilla: 0, Forge: 1, Fabric: 4, NeoForge: 6 };
const CONTENT_EXTENSIONS = { mod: '.jar', resourcepack: '.zip', shader: '.zip' };

async function readJson(response, source) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `${source} gagal (${response.status}).`);
  return body;
}

function modrinthParams(selection, query = '', projectType = 'mod') {
  const facets = [[`project_type:${projectType}`], [`versions:${selection.minecraftVersion}`]];
  if (projectType === 'mod' && selection.loader && selection.loader !== 'Vanilla') facets.push([`categories:${selection.loader.toLowerCase()}`]);
  const params = new URLSearchParams({ limit: '30', facets: JSON.stringify(facets) });
  if (query.trim()) params.set('query', query.trim());
  return params;
}

async function searchModrinthContent(query, selection, projectType = 'mod') {
  const response = await fetch(`${MODRINTH_API}/search?${modrinthParams(selection, query, projectType)}`, {
    headers: { 'User-Agent': 'DinastiXD/0.3 (launcher)' }
  });
  const body = await readJson(response, 'Pencarian Modrinth');
  return body.hits.map((hit) => ({
    source: 'Modrinth',
    projectType,
    id: hit.project_id,
    title: hit.title,
    description: hit.description,
    icon: hit.icon_url,
    downloads: hit.downloads,
    slug: hit.slug
  }));
}

async function searchModrinthMods(query, selection) {
  return searchModrinthContent(query, selection, 'mod');
}

async function curseForgeRequest(url, apiKey) {
  if (!apiKey) throw new Error('API key CurseForge belum diatur di Pengaturan.');
  const response = await fetch(url, { headers: { 'x-api-key': apiKey, Accept: 'application/json' } });
  const body = await readJson(response, 'CurseForge');
  return body.data;
}

async function searchCurseForgeContent(query, selection, apiKey, projectType = 'mod') {
  const loader = CURSEFORGE_LOADER_ID[selection.loader];
  if (!CURSEFORGE_CLASS_ID[projectType]) throw new Error(`Jenis konten CurseForge ${projectType} tidak didukung.`);
  if (projectType === 'mod' && (loader === undefined || loader === 0)) throw new Error('Pilih Fabric, Forge, atau NeoForge untuk mencari mod di CurseForge.');
  const params = new URLSearchParams({
    gameId: String(CURSEFORGE_GAME_ID),
    classId: String(CURSEFORGE_CLASS_ID[projectType]),
    gameVersion: selection.minecraftVersion,
    pageSize: '30',
    index: '0'
  });
  if (projectType === 'mod') params.set('modLoaderType', String(loader));
  if (query.trim()) params.set('searchFilter', query.trim());

  const data = await curseForgeRequest(`${CURSEFORGE_API}/mods/search?${params}`, apiKey);
  return data.map((mod) => ({
    source: 'CurseForge',
    projectType,
    id: String(mod.id),
    title: mod.name,
    description: mod.summary,
    icon: mod.logo?.url,
    downloads: mod.downloadCount,
    slug: mod.slug
  }));
}

async function searchCurseForgeMods(query, selection, apiKey) {
  return searchCurseForgeContent(query, selection, apiKey, 'mod');
}

function safeModFilename(filename, expectedExtension = '.jar') {
  const basename = path.basename(filename);
  if (basename !== filename || !/^[a-zA-Z0-9 _().+\-[\]]+\.(jar|zip)$/i.test(basename) || path.extname(basename).toLowerCase() !== expectedExtension) {
    throw new Error('Nama file konten tidak valid.');
  }
  return basename;
}

async function downloadVerifiedFile(url, destination, expectedHash, algorithm, expectedSize) {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== 'https:') throw new Error('Mod harus diunduh melalui HTTPS.');
  if (!Number.isSafeInteger(expectedSize) || expectedSize < 1 || expectedSize > 200 * 1024 * 1024) {
    throw new Error('Ukuran mod tidak valid atau melebihi batas 200 MB.');
  }

  const response = await fetch(parsedUrl);
  if (!response.ok || !response.body) throw new Error(`Unduhan mod gagal (${response.status}).`);
  const hash = crypto.createHash(algorithm);
  let downloadedSize = 0;
  const digestStream = new Transform({
    transform(chunk, _encoding, callback) {
      downloadedSize += chunk.length;
      if (downloadedSize > expectedSize || downloadedSize > 200 * 1024 * 1024) {
        callback(new Error('Unduhan mod melebihi ukuran resmi.'));
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    }
  });
  const temporaryPath = `${destination}.download`;
  try {
    await pipeline(Readable.fromWeb(response.body), digestStream, createWriteStream(temporaryPath, { flags: 'w' }));
    if (downloadedSize !== expectedSize || hash.digest('hex').toLowerCase() !== expectedHash.toLowerCase()) {
      throw new Error('Checksum mod tidak cocok; file unduhan ditolak.');
    }
    await fs.rm(destination, { force: true });
    await fs.rename(temporaryPath, destination);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}

async function getModrinthVersion(projectId, selection, projectType) {
  const query = { game_versions: JSON.stringify([selection.minecraftVersion]) };
  if (projectType === 'mod') query.loaders = JSON.stringify([selection.loader.toLowerCase()]);
  const params = new URLSearchParams(query);
  const response = await fetch(`${MODRINTH_API}/project/${encodeURIComponent(projectId)}/version?${params}`);
  const versions = await readJson(response, 'Versi mod Modrinth');
  const version = versions[0];
  if (!version) throw new Error('Tidak ada file mod yang cocok dengan versi Minecraft dan loader ini.');
  return version;
}

async function installModrinthContent(projectId, selection, destinationDirectory, projectType = 'mod', installed = new Set()) {
  if (!CONTENT_EXTENSIONS[projectType]) throw new Error(`Jenis konten ${projectType} belum didukung untuk instalasi.`);
  if (projectType === 'mod' && selection.loader === 'Vanilla') throw new Error('Mod Java memerlukan loader Fabric, Forge, atau NeoForge.');
  if (installed.has(projectId)) return [];
  if (installed.size >= 32) throw new Error('Batas 32 dependency mod terlampaui.');
  installed.add(projectId);

  const version = await getModrinthVersion(projectId, selection, projectType);
  const file = version.files.find((item) => item.primary) || version.files[0];
  if (!file?.hashes?.sha512) throw new Error('File Modrinth tidak memiliki checksum SHA-512.');
  const filename = safeModFilename(file.filename, CONTENT_EXTENSIONS[projectType]);
  await fs.mkdir(destinationDirectory, { recursive: true });
  await downloadVerifiedFile(file.url, path.join(destinationDirectory, filename), file.hashes.sha512, 'sha512', file.size);

  const results = [{ filename, title: version.name }];
  for (const dependency of version.dependencies || []) {
    if (dependency.dependency_type !== 'required' || !dependency.project_id) continue;
    results.push(...await installModrinthContent(dependency.project_id, selection, destinationDirectory, projectType, installed));
  }
  return results;
}

async function installModrinthProject(projectId, selection, modsDirectory, installed = new Set()) {
  return installModrinthContent(projectId, selection, modsDirectory, 'mod', installed);
}

async function getCurseForgeFile(modId, selection, apiKey, projectType = 'mod') {
  const loader = CURSEFORGE_LOADER_ID[selection.loader];
  const params = new URLSearchParams({
    gameVersion: selection.minecraftVersion,
    pageSize: '20',
    index: '0'
  });
  if (projectType === 'mod') params.set('modLoaderType', String(loader));
  const files = await curseForgeRequest(`${CURSEFORGE_API}/mods/${encodeURIComponent(modId)}/files?${params}`, apiKey);
  const file = files.find((candidate) => candidate.downloadUrl && (candidate.gameVersions || []).includes(selection.minecraftVersion));
  if (!file) throw new Error('CurseForge tidak menyediakan file langsung yang cocok untuk versi ini.');
  return file;
}

async function installCurseForgeProject(modId, selection, modsDirectory, apiKey) {
  const file = await getCurseForgeFile(modId, selection, apiKey);
  const filename = safeModFilename(file.fileName, '.jar');
  const checksum = file.hashes?.find((hash) => hash.algo === 1);
  if (!checksum?.value) throw new Error('File CurseForge tidak memiliki checksum SHA-1.');
  await fs.mkdir(modsDirectory, { recursive: true });
  await downloadVerifiedFile(file.downloadUrl, path.join(modsDirectory, filename), checksum.value, 'sha1', file.fileLength);
  return [{ filename, title: file.displayName }];
}

async function installModrinthResource(projectId, selection, resourcesDirectory, resourceType) {
  if (!['resourcepack', 'shader'].includes(resourceType)) throw new Error('Jenis resource belum didukung.');
  return installModrinthContent(projectId, selection, resourcesDirectory, resourceType);
}

async function installCurseForgeResource(modId, selection, resourcesDirectory, apiKey, resourceType) {
  if (!['resourcepack', 'shader'].includes(resourceType)) throw new Error('Jenis resource belum didukung.');
  const file = await getCurseForgeFile(modId, selection, apiKey, resourceType);
  const filename = safeModFilename(file.fileName, '.zip');
  const checksum = file.hashes?.find((hash) => hash.algo === 1);
  if (!checksum?.value) throw new Error('File CurseForge tidak memiliki checksum SHA-1.');
  await fs.mkdir(resourcesDirectory, { recursive: true });
  await downloadVerifiedFile(file.downloadUrl, path.join(resourcesDirectory, filename), checksum.value, 'sha1', file.fileLength);
  return [{ filename, title: file.displayName }];
}

module.exports = {
  downloadVerifiedFile,
  installCurseForgeProject,
  installCurseForgeResource,
  installModrinthResource,
  installModrinthProject,
  searchCurseForgeContent,
  searchModrinthContent,
  safeModFilename,
  searchCurseForgeMods,
  searchModrinthMods
};