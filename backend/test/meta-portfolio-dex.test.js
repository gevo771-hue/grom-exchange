import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const wallet = fs.readFileSync(path.join(root, 'frontend/public/grom-wallet.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'frontend/public/index.html'), 'utf8');
const market = fs.readFileSync(path.join(root, 'backend/src/market/routes.js'), 'utf8');

test('DEX Meta-Portfolio is mounted without retired wallet overview dependency', () => {
  assert.match(wallet, /function gwSetupMetaPortfolio\(\)/);
  assert.match(wallet, /function gwRefreshCombinedPortfolioTotals\(\)/);
  assert.match(wallet, /safe\('metaPortfolio',\s+gwSetupMetaPortfolio\)/);
  assert.match(wallet, /GW_MP_DEX_SNAP_KEY/);
  assert.doesNotMatch(wallet, /\/api\/wallet\/overview/);
});

test('dashboard portfolio, P&L and assets KPIs use live DEX data', () => {
  for (const id of ['dashPortfolioVal', 'dashPnlVal', 'dashOpenPos']) {
    assert.match(index, new RegExp(`id=["']${id}["']`));
  }
  assert.match(wallet, /cryptoChange24h/);
  assert.match(wallet, /dashPnlVal/);
  assert.match(wallet, /assetsN/);
  assert.match(market, /include_24hr_change:\s*true/);
  assert.match(market, /cryptoChange24h/);
});
