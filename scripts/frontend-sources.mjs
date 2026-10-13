import { execFileSync } from 'node:child_process';
import { copyFileSync, lstatSync, mkdirSync, realpathSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

// Only versioned sources belong in a release. Old dist copies, local previews,
// compressed twins and backups in public/ must never become build inputs.
export function frontendSources(root) {
  root = realpathSync(root);
  const prefix = 'frontend/public/';
  let entries;
  try {
    entries = execFileSync('git', ['ls-files', '--stage', '-z', '--', prefix], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    }).split('\0').filter(Boolean);
  } catch {
    throw new Error('Frontend build requires a Git checkout; add new public assets with git add before building.');
  }
  const sourceRoot = resolve(root, prefix);
  const files = entries.map((entry) => {
    const match = /^(100644|100755) [0-9a-f]+ 0\t(.+)$/.exec(entry);
    if (!match || !match[2].startsWith(prefix)) throw new Error('Invalid or conflicted frontend source entry');
    const file = match[2].slice(prefix.length);
    const path = resolve(sourceRoot, file);
    if (!path.startsWith(sourceRoot + sep) || !lstatSync(path).isFile() || realpathSync(path) !== path) {
      throw new Error(`Frontend source must be a regular file inside public/: ${file}`);
    }
    return file;
  });
  if (!files.includes('index.html')) throw new Error('Missing versioned frontend/public/index.html');
  return files.sort();
}

export function copyFrontendSources(root, out, files = frontendSources(root)) {
  for (const file of files) {
    const target = join(out, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(root, 'frontend/public', file), target);
  }
}
