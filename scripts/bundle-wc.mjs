#!/usr/bin/env node
// Self-host the single SignClient used by GROM; no second Core or AppKit modal.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const sha = (value) => createHash('sha256').update(value).digest('hex');

function inputs(root) {
  const pkg = JSON.parse(readFileSync(join(root, 'scripts/walletconnect/package.json')));
  return {
    sdk: '@walletconnect/sign-client',
    version: pkg.dependencies['@walletconnect/sign-client'],
    packageSha256: sha(readFileSync(join(root, 'scripts/walletconnect/package.json'))),
    lockSha256: sha(readFileSync(join(root, 'scripts/walletconnect/package-lock.json'))),
    recipeSha256: sha(readFileSync(join(root, 'scripts/bundle-wc.mjs'))),
  };
}

// A stale directory or old checked-in bundle must never silently satisfy an SDK upgrade.
export function verifyWcBundle(root = ROOT) {
  const expected = inputs(root);
  const actual = JSON.parse(readFileSync(join(root, 'frontend/public/wc/bundle-meta.json')));
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) throw new Error(`WalletConnect bundle mismatch: ${key}; run node scripts/bundle-wc.mjs`);
  }
  const content = readFileSync(join(root, 'frontend/public/wc/sign-client.bundle.js'));
  if (actual.sha256 !== sha(content)) throw new Error('WalletConnect bundle checksum mismatch');
  return actual;
}

async function bundle() {
  const tmp = join(ROOT, '.wc-bundle-tmp');
  const out = join(ROOT, 'frontend/public/wc');
  mkdirSync(tmp, { recursive: true });
  mkdirSync(out, { recursive: true });
  for (const file of ['package.json', 'package-lock.json']) {
    copyFileSync(join(ROOT, 'scripts/walletconnect', file), join(tmp, file));
  }
  // Clean locked install on every rebuild; lifecycle scripts are not needed.
  execFileSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: tmp, stdio: 'inherit' });
  const require = createRequire(join(tmp, 'package.json'));
  const { build } = require('esbuild');
  const expected = inputs(ROOT);
  const installed = JSON.parse(readFileSync(join(tmp, 'node_modules/@walletconnect/sign-client/package.json'))).version;
  if (installed !== expected.version) throw new Error('Installed WalletConnect version does not match the lock');
  const result = await build({
    stdin: { contents: "export { default, default as SignClient } from '@walletconnect/sign-client';", resolveDir: tmp, sourcefile: 'sign-client-entry.mjs' },
    absWorkingDir: tmp, bundle: true, format: 'esm', platform: 'browser', target: 'es2020', minify: true,
    banner: { js: `/* GROM WalletConnect SignClient ${expected.version}; see bundle-meta.json */` },
    write: false,
  });
  const content = result.outputFiles[0].contents;
  const meta = { ...expected, sha256: sha(content), bytes: content.length };
  writeFileSync(join(out, 'sign-client.bundle.js.next'), content);
  writeFileSync(join(out, 'bundle-meta.json.next'), JSON.stringify(meta, null, 2) + '\n');
  renameSync(join(out, 'sign-client.bundle.js.next'), join(out, 'sign-client.bundle.js'));
  renameSync(join(out, 'bundle-meta.json.next'), join(out, 'bundle-meta.json'));
  verifyWcBundle();
  console.log(`[bundle-wc] SignClient ${installed}: ${content.length} bytes, locked and verified`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await bundle();
