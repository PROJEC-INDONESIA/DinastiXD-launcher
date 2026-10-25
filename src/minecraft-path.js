const fs = require('node:fs/promises');
const path = require('node:path');

async function resolveInsideRoot(root, relativePath = '') {
  if (typeof relativePath !== 'string') throw new Error('Jalur file tidak valid.');
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Jalur harus berada di dalam folder .minecraft.');
  }

  const [realRoot, realTarget] = await Promise.all([fs.realpath(root), fs.realpath(target)]);
  const realRelative = path.relative(realRoot, realTarget);
  if (realRelative === '..' || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) {
    throw new Error('Jalur harus berada di dalam folder .minecraft.');
  }

  return realTarget;
}

module.exports = { resolveInsideRoot };