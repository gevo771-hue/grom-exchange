import test from 'node:test';
import assert from 'node:assert/strict';
import { pickPlatform, diffNewCoins, buildRows, createNewListings } from '../src/market/new-listings.js';

const EVM = '0x' + 'ab'.repeat(20);
const SOL = 'So11111111111111111111111111111111111111112';

test('pickPlatform takes the first network GROM can swap', () => {
  assert.equal(pickPlatform({ 'some-l1': 'x', ethereum: EVM.toUpperCase().replace('0X', '0x') }).chainId, 1);
  assert.equal(pickPlatform({ solana: SOL }).chain, 'solana');
  assert.equal(pickPlatform({ ethereum: 'not-an-address' }), null);
  assert.equal(pickPlatform({}), null);
});

test('diffNewCoins returns only ids that were not known', () => {
  const got = diffNewCoins([{ id: 'a' }, { id: 'b' }, { id: 'c' }], new Set(['a', 'c']));
  assert.deepEqual(got.map((c) => c.id), ['b']);
});

test('buildRows: newest first, priced, traded, with decimals, last 24 h only', () => {
  const now = Date.parse('2026-11-15T20:00:00Z');
  const fresh = [
    { id: 'old', at: now - 30 * 3600e3, chain: 'eth', chainId: 1, address: EVM },
    { id: 'a', at: now - 5 * 3600e3, chain: 'eth', chainId: 1, address: EVM },
    { id: 'b', at: now - 1 * 3600e3, chain: 'solana', chainId: 1151111081099710, address: SOL },
    { id: 'nodec', at: now - 2 * 3600e3, chain: 'eth', chainId: 1, address: EVM },
    { id: 'dead', at: now - 2 * 3600e3, chain: 'eth', chainId: 1, address: EVM },
  ];
  const markets = [
    { id: 'old', symbol: 'old', current_price: 1, total_volume: 1e6 },
    { id: 'a', symbol: 'aaa', name: 'A', image: 'https://x/a.png', current_price: 0.5, total_volume: 2e5, price_change_percentage_24h: 12.5 },
    { id: 'b', symbol: 'bbb', name: 'B', image: 'http://insecure', current_price: 2, total_volume: 9e4, price_change_percentage_24h: null },
    { id: 'nodec', symbol: 'n', current_price: 1, total_volume: 1e6 },
    { id: 'dead', symbol: 'd', current_price: 1, total_volume: 10 },
  ];
  const dec = new Map([['old', 18], ['a', 18], ['b', 9], ['dead', 18]]);
  const rows = buildRows(fresh, markets, dec, { now });
  assert.deepEqual(rows.map((r) => r.sym), ['BBB', 'AAA']);
  assert.equal(rows[0].img, '');
  assert.equal(rows[0].decimals, 9);
  assert.equal(rows[1].chg, 12.5);
});

test('service: first coin list is the baseline, later additions become listings', async () => {
  let t = Date.parse('2026-11-15T10:00:00Z');
  const base = Array.from({ length: 1200 }, (_, i) => ({ id: 'c' + i, symbol: 's' + i, name: 'C' + i, platforms: {} }));
  let list = base;
  const calls = [];
  const get = async (url, opts) => {
    calls.push(url);
    if (url.endsWith('/coins/list')) return { data: list };
    if (url.includes('/networks/eth/tokens/')) return { data: { data: { attributes: { decimals: 18 } } } };
    if (url.endsWith('/coins/markets')) {
      return { data: opts.params.ids.split(',').map((id) => ({ id, symbol: id, name: id, image: 'https://img/' + id, current_price: 1, total_volume: 50000, price_change_percentage_24h: 3 })) };
    }
    throw new Error('unexpected ' + url);
  };
  const svc = createNewListings({ get, now: () => t, file: '', apiKey: '', pause: async () => {} });
  let p = await svc.get();
  assert.equal(p.count, 0);
  list = base.concat([
    { id: 'fresh-one', symbol: 'new', name: 'New One', platforms: { ethereum: EVM } },
    { id: 'no-chain', symbol: 'l1', name: 'Own L1', platforms: { 'some-l1': '' } },
    { id: 'tesla-xstock', symbol: 'tslax', name: 'Tesla xStock', platforms: { ethereum: EVM } },
  ]);
  t += 31 * 60_000;
  await svc.refreshList();
  t += 6 * 60_000;
  p = await svc.get();
  assert.deepEqual(p.rows.map((r) => r.id), ['fresh-one']);
  assert.equal(p.rows[0].chainId, 1);
  assert.equal(p.rows[0].decimals, 18);
  assert.ok(calls.some((u) => u.includes('/networks/eth/tokens/')));
});
