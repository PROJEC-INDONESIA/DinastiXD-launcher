const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { resolveInsideRoot } = require('../src/minecraft-path');

test('resolves an existing file inside the game directory', async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dinastixd-path-'));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'options.txt'), 'safe');

  assert.equal(await resolveInsideRoot(root, 'options.txt'), await fs.realpath(path.join(root, 'options.txt')));
});

test('rejects traversal outside the game directory', async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dinastixd-path-'));
  context.after(() => fs.rm(root, { recursive: true, force: true }));

  await assert.rejects(resolveInsideRoot(root, '../outside'), /folder \.minecraft/);
});

test('rejects symlinks that escape the game directory', async (context) => {
  if (process.platform === 'win32') context.skip('Symlink creation may require elevated Windows permissions.');
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'dinastixd-path-'));
  context.after(() => fs.rm(parent, { recursive: true, force: true }));
  const root = path.join(parent, '.minecraft');
  const outside = path.join(parent, 'outside.txt');
  await fs.mkdir(root);
  await fs.writeFile(outside, 'outside');
  await fs.symlink(outside, path.join(root, 'link.txt'));

  await assert.rejects(resolveInsideRoot(root, 'link.txt'), /folder \.minecraft/);
});