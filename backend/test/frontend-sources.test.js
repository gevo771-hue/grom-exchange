import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { frontendSources, copyFrontendSources } from '../../scripts/frontend-sources.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'grom-source-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'frontend/public/assets'), { recursive: true });
  writeFileSync(join(root, 'frontend/public/index.html'), '<main>current</main>');
  writeFileSync(join(root, 'frontend/public/assets/logo.svg'), '<svg/>');
  execFileSync('git', ['init', '-q', root]);
  execFileSync('git', ['add', 'frontend/public'], { cwd: root });
  return root;
}

test('build input excludes old bundles, gzip, previews and secrets, while keeping nested assets', (t) => {
  const root = fixture(t);
  const junk = ['old.js', 'old.12345678.js', 'index.html.gz', '.env', 'preview.html', 'assets/backup.bak'];
  for (const f of junk) writeFileSync(join(root, 'frontend/public', f), 'stale');
  const files = frontendSources(root);
  assert.deepEqual(files, ['assets/logo.svg', 'index.html']);
  const out = join(root, 'dist');
  copyFrontendSources(root, out, files);
  assert.equal(readFileSync(join(out, 'index.html'), 'utf8'), '<main>current</main>');
  assert.ok(existsSync(join(out, 'assets/logo.svg')));
  for (const f of junk) assert.equal(existsSync(join(out, f)), false, f);
});

test('a new source is included only after it is added to Git', (t) => {
  const root = fixture(t);
  writeFileSync(join(root, 'frontend/public/new.js'), 'new source');
  assert.ok(!frontendSources(root).includes('new.js'));
  execFileSync('git', ['add', 'frontend/public/new.js'], { cwd: root });
  assert.ok(frontendSources(root).includes('new.js'));
});

test('missing versioned files abort input validation', (t) => {
  const root = fixture(t);
  rmSync(join(root, 'frontend/public/assets/logo.svg'));
  assert.throws(() => frontendSources(root), /ENOENT/);
});

test('symlinks cannot smuggle files from outside public into a release', (t) => {
  const root = fixture(t);
  const logo = join(root, 'frontend/public/assets/logo.svg');
  rmSync(logo);
  writeFileSync(join(root, 'secret'), 'private');
  symlinkSync(join(root, 'secret'), logo);
  assert.throws(() => frontendSources(root), /regular file/);
  execFileSync('git', ['add', 'frontend/public/assets/logo.svg'], { cwd: root });
  assert.throws(() => frontendSources(root), /Invalid/);
});

test('a source folder without Git metadata cannot silently ship arbitrary files', (t) => {
  const root = fixture(t);
  rmSync(join(root, '.git'), { recursive: true });
  assert.throws(() => frontendSources(root), /Git checkout/);
});
