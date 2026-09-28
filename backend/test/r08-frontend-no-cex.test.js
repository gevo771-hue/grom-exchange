import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const candidates = [
  join(process.cwd(), 'frontend', 'public'),
  join(process.cwd(), '..', 'frontend', 'public'),
];
const root = candidates.find((p) => existsSync(join(p, 'grom-wallet.js')));
assert.ok(root, 'frontend/public not found');

const files = ['grom-wallet.js', 'grom-wallet-dash.js', 'grom-instruments.js', 'index.html'];

/** Live (non-retired) forbidden patterns */
const FORBIDDEN = [
  /https?:\/\/api\.binance\.com/,
  /wss?:\/\/stream\.binance\.com/,
  /https?:\/\/api\.coinbase\.com/,
  /https?:\/\/api\.kraken\.com/,
  /\bbinanceP2P\b/,
  /\bbybitP2P\b/,
  /['"`]\/api\/wallet\/deposit-address['"`?]/,
  /['"`]\/api\/wallet\/withdrawals['"`?/]/,
  /['"`]\/api\/swap\/convert\/accept['"`?/]/,
  /['"`]\/auth\/email-login['"`?/]/,
];

describe('R08 frontend has no live CEX/custodial endpoints', () => {
  for (const name of files) {
    it(`${name} clean of forbidden CEX/custodial URLs`, () => {
      const p = join(root, name);
      assert.ok(existsSync(p), p);
      const txt = readFileSync(p, 'utf8');
      for (const re of FORBIDDEN) {
        const m = txt.match(re);
        assert.equal(m, null, `${name} matched ${re}: ${m && m[0]}`);
      }
      if (name === 'grom-wallet.js' || name === 'index.html') {
        assert.match(txt, /Coinbase Wallet|connectCoinbase|'cb'/);
        assert.match(txt, /Binance Web3|bnw3|connectBinanceWeb3/);
      }
    });
  }

  it('fee remains 0.002 and Sol/Tron fee skip removed', () => {
    const txt = readFileSync(join(root, 'grom-wallet.js'), 'utf8');
    assert.match(txt, /GW_LIFI_FEE_PCT\s*=\s*0\.002/);
    assert.doesNotMatch(txt, /Sol\/Tron source legs cannot collect/);
  });
});
