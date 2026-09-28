/**
 * Product-health gate — must stay green or deploy is blocked.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');

describe('LI.FI API key fail-closed', () => {
  it('disables only LI.FI when the key is absent', () => {
    const cfg = readFileSync(join(repoRoot, 'backend/src/config/index.js'), 'utf8');
    const server = readFileSync(join(repoRoot, 'backend/src/server.js'), 'utf8');
    assert.match(cfg, /lifiApiKey:\s*env\('LIFI_API_KEY',\s*''\)/);
    assert.doesNotMatch(cfg, /LIFI_API_KEY is required when GROM fee routes are enabled/);
    assert.match(server, /lifi:\s*lifiKeyOk\s*&&\s*recvOk/);
    assert.match(server, /code:\s*'lifi_unavailable'/);
  });
});

describe('product-health regression gate', () => {
  it('assert-product-health.mjs passes on current tree', () => {
    const r = spawnSync(process.execPath, ['scripts/assert-product-health.mjs'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, (r.stderr || '') + (r.stdout || ''));
  });

  it('classify maps markets_hip3 + xstocks_soon to admin causes', async () => {
    const { classifyIssue } = await import('../src/activity/classify.js');
    const a = classifyIssue({
      product: 'markets',
      action: 'markets_hip3_empty',
      message: 'HIP-3/TradFi почти пуст',
    });
    assert.equal(a.cause, 'markets_stale');
    const b = classifyIssue({
      product: 'xstocks',
      action: 'xstocks_soon_stuck',
      message: 'Страница акций зависла на «Скоро»',
    });
    assert.equal(b.cause, 'xstocks');
  });
});
