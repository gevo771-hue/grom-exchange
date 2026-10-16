import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyWcBundle } from '../../scripts/bundle-wc.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('offline WalletConnect fallback accepts only the current locked bundle', () => {
  assert.equal(verifyWcBundle(root).version, '2.26.0');
});

for (const file of ['scripts/walletconnect/package.json', 'scripts/walletconnect/package-lock.json',
  'scripts/bundle-wc.mjs', 'frontend/public/wc/sign-client.bundle.js']) {
  test(`offline WalletConnect fallback rejects changed ${file}`, (t) => {
    const fixture = mkdtempSync(join(tmpdir(), 'grom-wc-check-'));
    t.after(() => rmSync(fixture, { recursive: true, force: true }));
    for (const path of ['scripts/walletconnect', 'scripts/bundle-wc.mjs', 'frontend/public/wc']) {
      cpSync(join(root, path), join(fixture, path), { recursive: true });
    }
    verifyWcBundle(fixture);
    const path = join(fixture, file);
    writeFileSync(path, readFileSync(path, 'utf8') + '\n');
    assert.throws(() => verifyWcBundle(fixture), /mismatch/);
  });
}
