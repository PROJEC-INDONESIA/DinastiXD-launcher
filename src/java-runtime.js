const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const { createWriteStream, createReadStream } = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { Readable } = require('node:stream');
const { open, openEntryReadStream, walkEntriesGenerator } = require('@xmcl/unzip');

async function resolveJavaExecutable(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isFile() && ['javaw.exe', 'java.exe'].includes(entry.name.toLowerCase())) return target;
    if (entry.isDirectory()) {
      const nested = await resolveJavaExecutable(target).catch(() => undefined);
      if (nested) return nested;
    }
  }
  return undefined;
}

async function sha256File(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function extractVerifiedZip(archivePath, destination) {
  await fs.mkdir(destination, { recursive: true });
  const zip = await open(archivePath);
  try {
    for await (const entry of walkEntriesGenerator(zip)) {
      const relative = entry.fileName.replaceAll('\\', '/');
      const target = path.resolve(destination, relative);
      const inside = path.relative(destination, target);
      if (inside === '..' || inside.startsWith(`..${path.sep}`) || path.isAbsolute(inside)) {
        throw new Error('Arsip Java memiliki jalur file yang tidak valid.');
      }
      if (relative.endsWith('/')) {
        await fs.mkdir(target, { recursive: true });
        continue;
      }
      await fs.mkdir(path.dirname(target), { recursive: true });
      await pipeline(await openEntryReadStream(zip, entry), createWriteStream(target, { flags: 'wx' }));
    }
  } finally {
    zip.close();
  }
}

async function installAdoptiumJava(gameDirectory, majorVersion, onStatus = () => {}) {
  if (process.platform !== 'win32') {
    throw new Error(`Java ${majorVersion} belum terpasang. Instal Java ${majorVersion} untuk sistem operasi ini.`);
  }

  const architecture = process.arch === 'ia32' ? 'x32' : 'x64';
  const query = new URLSearchParams({ architecture, image_type: 'jre', os: 'windows', vendor: 'eclipse' });
  const apiUrl = `https://api.adoptium.net/v3/assets/latest/${majorVersion}/hotspot?${query}`;
  const response = await fetch(apiUrl);
  if (!response.ok) throw new Error(`Runtime Java ${majorVersion} tidak tersedia untuk perangkat ini.`);
  const [release] = await response.json();
  const binary = release?.binary?.package;
  if (!binary?.link || !/^[a-f\d]{64}$/i.test(binary.checksum)) {
    throw new Error('Metadata unduhan Java tidak valid.');
  }

  const downloadUrl = new URL(binary.link);
  if (downloadUrl.protocol !== 'https:' || downloadUrl.hostname !== 'github.com') {
    throw new Error('Sumber runtime Java tidak tepercaya.');
  }

  const runtimeRoot = path.join(gameDirectory, 'runtime', `dinasti-java-${majorVersion}-${architecture}`);
  const existingJava = await resolveJavaExecutable(runtimeRoot).catch(() => undefined);
  if (existingJava) return existingJava;

  const temporaryRoot = `${runtimeRoot}.installing`;
  const archivePath = `${temporaryRoot}.zip`;
  await fs.rm(temporaryRoot, { recursive: true, force: true });
  await fs.mkdir(path.dirname(runtimeRoot), { recursive: true });

  try {
    onStatus(`Mengunduh Java ${majorVersion} resmi...`);
    const download = await fetch(downloadUrl);
    if (!download.ok || !download.body) throw new Error(`Unduhan Java gagal (${download.status}).`);
    await pipeline(Readable.fromWeb(download.body), createWriteStream(archivePath));

    onStatus('Memeriksa checksum runtime Java...');
    const actualChecksum = await sha256File(archivePath);
    if (actualChecksum.toLowerCase() !== binary.checksum.toLowerCase()) {
      throw new Error('Checksum runtime Java tidak cocok; file unduhan ditolak.');
    }

    onStatus('Memasang runtime Java...');
    await extractVerifiedZip(archivePath, temporaryRoot);
    const executable = await resolveJavaExecutable(temporaryRoot);
    if (!executable) throw new Error('Arsip berhasil diunduh, tetapi javaw.exe tidak ditemukan.');
    await fs.rm(runtimeRoot, { recursive: true, force: true });
    await fs.rename(temporaryRoot, runtimeRoot);
    return path.join(runtimeRoot, path.relative(temporaryRoot, executable));
  } finally {
    await fs.rm(archivePath, { force: true });
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}

module.exports = { installAdoptiumJava, resolveJavaExecutable };