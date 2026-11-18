import test from 'node:test';
import assert from 'node:assert/strict';
import { createGtGate } from '../src/market/gt-gate.js';
import { createTrendingService } from '../src/market/trending.js';
import { createTokenLogos } from '../src/liquidity/token-logos.js';

function clock(start = 1_800_000_000_000) {
  const c = { t: start };
  c.now = () => c.t;
  c.pause = async (ms) => { c.t += ms; };
  return c;
}

test('GeckoTerminal gate: calls are spaced and the minute budget is kept', async () => {
  const c = clock();
  const gate = createGtGate({ now: c.now, pause: c.pause, perMin: 25, gapMs: 2100 });
  const starts = [];
  for (let i = 0; i < 30; i++) { assert.equal(await gate.slot(), true); starts.push(c.t); }
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= 2100);
  for (let i = 25; i < starts.length; i++) assert.ok(starts[i] - starts[i - 25] >= 60_000); // never 26 in a minute
});

test('GeckoTerminal gate: background work leaves room for Trending', async () => {
  const c = clock();
  const gate = createGtGate({ now: c.now, pause: c.pause, perMin: 25, backgroundPerMin: 10, gapMs: 2100 });
  for (let i = 0; i < 10; i++) assert.equal(await gate.slot(), true);
  assert.equal(await gate.slot({ background: true, maxWaitMs: 5_000 }), false); // 10 calls this minute: background waits
  assert.equal(await gate.slot(), true); // Trending still goes
});

test('GeckoTerminal gate: after a 429 nobody calls until Retry-After has passed', async () => {
  const c = clock();
  const gate = createGtGate({ now: c.now, pause: c.pause });
  gate.note429({ response: { status: 429, headers: { 'retry-after': '90' } } });
  assert.equal(gate.cooling(), true);
  assert.equal(await gate.slot({ background: true, maxWaitMs: 3_000 }), false);
  const t0 = c.t;
  assert.equal(await gate.slot({ maxWaitMs: 120_000 }), true);
  assert.ok(c.t - t0 >= 90_000 - 3_000);
  gate.note429({ response: { status: 429, headers: {} } });
  assert.ok(gate.coolUntil() - c.t >= 60_000); // at least a minute even without Retry-After
});

test('a 429 seen by token logos pauses Trending too (shared gate), cached rows still serve', async () => {
  const c = clock();
  const gate = createGtGate({ now: c.now, pause: c.pause });
  let trendCalls = 0;
  const pool = { data: [{ attributes: { address: 'pool', base_token_price_usd: '1', price_change_percentage: { h24: '5' }, volume_usd: { h24: '1000' } }, relationships: { base_token: { data: { id: 't' } } } }], included: [{ id: 't', attributes: { symbol: 'AAA', name: 'Aaa', address: '0xaaa', decimals: 18 } }] };
  const trending = createTrendingService({
    nets: [{ key: 'all' }, { key: 'base', gt: 'base', chainId: 8453, label: 'BASE' }],
    now: c.now, pause: c.pause, gate,
    get: async () => { trendCalls++; return { data: pool }; },
  });
  const first = await trending('base');
  assert.equal(first.rows.length, 1);
  assert.equal(trendCalls, 1);

  const logos = createTokenLogos({
    now: c.now, gate, loadCoins: async () => ({ coinOf: new Map(), logos: new Map() }),
    get: async (url) => {
      if (url.includes('dexscreener')) return { data: [] };
      throw Object.assign(new Error('limited'), { response: { status: 429, headers: { 'retry-after': '120' } } });
    },
  });
  const meta = {};
  await logos(8453, ['0x' + '1'.repeat(40)], meta);
  assert.equal(meta.partial, true);
  assert.equal(gate.cooling(), true);

  c.t += 100_000; // Trending's own cache has expired, the provider is still cooling down
  const again = await trending('base');
  assert.equal(trendCalls, 1); // no call while cooling
  assert.equal(again.rows.length, 1); // last good rows (within 10 minutes) are served
});
