import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../frontend/public/index.html', import.meta.url), 'utf8');
const start = html.indexOf('function gromHlCoinForPair(');
const end = html.indexOf('\n/** Compact full price for narrow futures list', start);
assert.ok(start >= 0 && end > start, 'HL quote helpers must remain available in the application shell');
const helpers = html.slice(start, end);

function makeContext() {
  const window = {
    __gromHlActive: true,
    __hlMids: { ETH: 100 },
    __hlSpotMids: { ETH: 2 },
    __hlCtx: { ETH: { markPx: 100, prevDayPx: null, chg24: null } },
    __hlSpotCtx: { ETH: { markPx: 2, prevDayPx: null, chg24: null } },
    __hlMarkets: [{ sym: 'ETH/USDT', coin: 'ETH', chg24: null, spot: false }],
    __hlSpotMarkets: [{ sym: 'ETH/USDC', coin: 'ETH', chg24: null, spot: true }],
    gromHL: { coinFromPair: (pair) => String(pair).split('/')[0].toUpperCase() },
    futDeskState: { tradeMode: 'perp' },
  };
  const context = {
    window,
    futDeskState: window.futDeskState,
    gromLiveChangeForPair: () => 99,
  };
  vm.createContext(context);
  vm.runInContext(helpers, context);
  return context;
}

test('HL quote lookup stays on the selected venue and hides missing values', () => {
  const c = makeContext();
  assert.equal(c.gromHlPriceForPair('ETH/USDT', 'ETH', 'perp'), 100);
  assert.equal(c.gromHlPriceForPair('ETH/USDC', 'ETH', 'spot'), 2);
  assert.equal(Number.isNaN(c.gromHlPriceForPair('MISSING/USDT', 'MISSING', 'perp')), true);

  assert.equal(Number.isNaN(c.futuresChg24ForPair('ETH/USDT', 'ETH', 'perp')), true);
  c.window.__hlCtx.ETH.chg24 = 0;
  assert.equal(c.futuresChg24ForPair('ETH/USDT', 'ETH', 'perp'), 0);
  c.window.__hlCtx.ETH.prevDayPx = 100;
  c.window.__hlCtx.ETH.chg24 = 0;
  c.window.__hlMids.ETH = 102;
  assert.ok(Math.abs(c.futuresChg24ForPair('ETH/USDT', 'ETH', 'perp') - 2) < 1e-9);
  assert.equal(Number.isNaN(c.futuresChg24ForPair('MISSING/USDT', 'MISSING', 'perp')), true);
});

test('missing Hyperliquid change never falls back to a seeded registry percentage', () => {
  const c = makeContext();
  c.window.__gromHlActive = false;
  assert.equal(Number.isNaN(c.futuresChg24ForPair('ETH/USDT', 'ETH', 'spot')), true);
});
