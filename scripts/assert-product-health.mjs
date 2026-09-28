#!/usr/bin/env node
/**
 * Product-health regression gate — fails deploy if known bug-fixes disappear.
 * Complements remnant bans in assert-frontend-clean.mjs.
 *
 * Catches earlier / blocks regressions for:
 *  - HIP-3 batched meta (Chrome 429 → empty TradFi)
 *  - xstocks catalog kick (seed «Скоро» stuck)
 *  - token picker same-asset bridge + xchain jump + logo flicker guards
 *  - AI watchdog checks for markets/xstocks
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
let errors = 0;
function fail(msg) {
  console.error('✗ product-health:', msg);
  errors++;
}
function ok(msg) {
  console.log('✓', msg);
}
function mustHave(file, needles, label) {
  const p = join(root, file);
  if (!existsSync(p)) {
    fail(`missing ${file}`);
    return;
  }
  const txt = readFileSync(p, 'utf8');
  for (const n of needles) {
    const hit = typeof n === 'string' ? txt.includes(n) : n.test(txt);
    if (!hit) fail(`${label || file}: missing required pattern ${n}`);
  }
}
function mustNotHave(file, needles, label) {
  const p = join(root, file);
  if (!existsSync(p)) return;
  const txt = readFileSync(p, 'utf8');
  for (const n of needles) {
    const hit = typeof n === 'string' ? txt.includes(n) : n.test(txt);
    if (hit) fail(`${label || file}: forbidden regression ${n}`);
  }
}

/* ---- HIP-3 / Markets (Chrome parallel 429) ---- */
mustHave(
  'frontend/public/grom-hyperliquid.js',
  [
    'Chrome opens many parallel sockets',
    'ensureHip3Only',
    'loadHip3Dexes',
    'xyz (TradFi) alone first',
    'scheduleHip3Backfill',
    'markets_hip3_empty',
  ],
  'HL meta',
);
mustNotHave(
  'frontend/public/grom-hyperliquid.js',
  [
    /await Promise\.all\(dexList\.map\(\(entry, dexIndex\)/,
    'BATCH = 2',
  ],
  'HL meta must not fire HIP-3 in parallel batches',
);

/* ---- xStocks catalog (seed Soon stuck) ---- */
mustHave(
  'frontend/public/index.html',
  [
    'gwxKickCatalog',
    'gwxCatalogReady',
    'gwx-catalog-load',
    'xstocks_catalog_stuck',
  ],
  'xstocks',
);
/* Soft reopen must still kick catalog (seed «Скоро» bug). */
{
  const idx = readFileSync(join(root, 'frontend/public/index.html'), 'utf8');
  const soft = idx.match(/function ensureXstocksPage[\s\S]{0,1600}?function ensurePages/);
  if (!soft || !/gwxKickCatalog/.test(soft[0])) {
    fail('ensureXstocksPage must call gwxKickCatalog (including soft reopen)');
  } else {
    ok('ensureXstocksPage kicks catalog');
  }
}

/* ---- Token picker ---- */
mustHave(
  'frontend/public/grom-wallet.js',
  [
    'allowSameSym',
    'skipFrom',
    '__gwTkXchainJump',
    'gwTkBestLogo',
    'list.dataset.tkFp',
    '__gwTkFeaturedDirty',
    'Keep Across networks while searching',
    'Jump puts Across networks first',
  ],
  'token picker',
);
mustNotHave(
  'frontend/public/grom-wallet.js',
  [
    'const shownRest = xJump ? [] : rest.slice',
    'if (xJump) popular = [];',
  ],
  'xJump must not hide same-chain list',
);

/* ---- AI monitor / watchdog ---- */
mustHave(
  'frontend/public/grom-wallet.js',
  [
    'function checkXstocks',
    'markets_hip3_empty',
    'xstocks_soon_stuck',
    'checkXstocks()',
  ],
  'client watchdog',
);
mustHave(
  'backend/src/activity/classify.js',
  [
    'markets_hip3',
    'xstocks_soon',
    'ui_lag',
  ],
  'classify',
);

if (errors) {
  console.error(`\n${errors} product-health gate failure(s)`);
  process.exit(1);
}
console.log('✓ product-health gate ok');
