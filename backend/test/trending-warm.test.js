import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrendingService } from '../src/market/trending.js';

const nets = [{ key: 'all' }, { key: 'eth', gt: 'eth', chainId: 1, label: 'ETH' }, { key: 'bsc', gt: 'bsc', chainId: 56, label: 'BSC' }];
function payload(sym = 'TKN', change = '10') {
  return {
    data: [{ attributes: { address: 'pool-' + sym, base_token_price_usd: '1', price_change_percentage: { h24: change }, pool_created_at: '2026-10-22T16:35:53Z', volume_usd: { h24: '1000' } }, relationships: { base_token: { data: { id: 't-' + sym } } } }],
    included: [{ id: 't-' + sym, attributes: { symbol: sym, name: sym, address: '0x' + sym, decimals: 18 } }],
  };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
function memStore(init) {
  const data = new Map(init ? Object.entries(init) : []);
  return { data, get: async (k) => (data.has(k) ? JSON.parse(JSON.stringify(data.get(k))) : null), set: async (k, v) => { data.set(k, JSON.parse(JSON.stringify(v))); } };
}

test('after a restart every saved network shows at once, without waiting for the provider (22.11)', async () => {
  let now = 1800000000000;
  const at = now - 60_000;
  const saved = { trending_cache: {
    eth: { at, rows: [{ chainId: 1, symbol: 'E', change24h: 5, observedAt: at }] },
    bsc: { at, rows: [{ chainId: 56, symbol: 'B', change24h: 7, observedAt: at }] },
  } };
  let calls = 0;
  const service = createTrendingService({ nets, now: () => now, pause: async () => {}, ttl: 180_000, store: memStore(saved),
    get: async () => { calls++; return new Promise(() => {}); } }); // provider hangs: saved rows must still show
  const all = await service('all');
  assert.deepEqual(all.rows.map((r) => r.chainId).sort(), [1, 56]);
  assert.equal(all.partial, false);
  assert.equal(calls, 0); // 1 min old < ttl: no provider call at all
});

test('fresh rows are saved for the next restart', async () => {
  const store = memStore();
  const service = createTrendingService({ nets, pause: async () => {}, store, get: async (url) => ({ data: payload(url.includes('/eth/') ? 'E' : 'B') }) });
  await service('eth');
  await new Promise((r) => setTimeout(r, 5200));
  const snap = store.data.get('trending_cache');
  assert.equal(snap.eth.rows[0].sym, 'E');
  assert.ok(snap.eth.at > 0);
});

test('warm() refreshes only networks older than ttl, oldest first', async () => {
  let now = 1800000000000;
  const order = [];
  const service = createTrendingService({ nets, now: () => now, pause: async () => {}, ttl: 180_000,
    get: async (url) => { const k = url.match(/networks\/(.*?)\//)[1]; order.push(k); return { data: payload(k) }; } });
  await service('bsc');
  now += 60_000;
  await service('eth');
  order.length = 0;
  now += 30_000;
  await service.warm();
  assert.deepEqual(order, []); // both fresh
  now += 100_000; // bsc 190 s old, eth 130 s old
  await service.warm();
  assert.deepEqual(order, ['bsc']);
  now += 60_000; // eth 190 s old
  await service.warm();
  assert.deepEqual(order, ['bsc', 'eth']);
});

test('old rows stay on screen up to staleTtl while the provider fails', async () => {
  let now = 1800000000000;
  let fail = false;
  const service = createTrendingService({ nets, now: () => now, pause: async () => {}, ttl: 180_000, staleTtl: 30 * 60_000,
    get: async () => { if (fail) throw Error('offline'); return { data: payload() }; } });
  await service('eth');
  fail = true;
  now += 20 * 60_000;
  const old = await service('eth');
  await tick();
  assert.equal(old.rows.length, 1);
  assert.equal(old.stale, true);
  now += 11 * 60_000;
  await assert.rejects(service('eth'), /unavailable/);
});
