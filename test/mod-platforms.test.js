const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  downloadVerifiedFile,
  safeModFilename,
  searchCurseForgeMods,
  searchModrinthMods
} = require('../src/mod-platforms');

test('Modrinth search filters by project type, Minecraft version, and loader', async () => {
  const originalFetch = global.fetch;
  let requestUrl;
  global.fetch = async (url) => {
    requestUrl = new URL(url);
    return new Response(JSON.stringify({ hits: [{ project_id: 'mod-id', title: 'Test Mod' }] }), { status: 200 });
  };

  try {
    const mods = await searchModrinthMods('sodium', { minecraftVersion: '1.21.1', loader: 'Fabric' });
    const facets = JSON.parse(requestUrl.searchParams.get('facets'));
    assert.equal(mods[0].title, 'Test Mod');
    assert.deepEqual(facets, [['project_type:mod'], ['versions:1.21.1'], ['categories:fabric']]);
  } finally {
    global.fetch = originalFetch;
  }
});

test('CurseForge refuses requests when no official API key is configured', async () => {
  await assert.rejects(searchCurseForgeMods('sodium', { minecraftVersion: '1.21.1', loader: 'Fabric' }, ''), /API key/);
});

test('mod downloads require HTTPS and a matching checksum', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dinastixd-mod-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const payload = Buffer.from('trusted mod bytes');
  const hash = crypto.createHash('sha512').update(payload).digest('hex');
  const target = path.join(directory, 'mod.jar');
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(payload, { status: 200 });

  try {
    await downloadVerifiedFile('https://cdn.example/mod.jar', target, hash, 'sha512', payload.length);
    assert.deepEqual(await fs.readFile(target), payload);
    await assert.rejects(downloadVerifiedFile('http://cdn.example/mod.jar', target, hash, 'sha512', payload.length), /HTTPS/);
    await assert.rejects(downloadVerifiedFile('https://cdn.example/mod.jar', path.join(directory, 'bad.jar'), '0'.repeat(128), 'sha512', payload.length), /Checksum/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('mod filename validation rejects path traversal', () => {
  assert.equal(safeModFilename('mod-file-1.0.jar'), 'mod-file-1.0.jar');
  assert.throws(() => safeModFilename('../outside.jar'), /Nama file/);
});