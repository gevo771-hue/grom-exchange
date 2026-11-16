import test from 'node:test';
import assert from 'node:assert/strict';
import { pickPlatform, swapPlatforms, diffNewCoins, buildRows, createNewListings } from '../src/market/new-listings.js';

const EVM = '0x' + 'ab'.repeat(20);
const SOL = 'So11111111111111111111111111111111111111112';

test('pickPlatform takes the first network GROM can swap, every swap network counts', () => {
  assert.equal(pickPlatform({ 'some-l1': 'x', ethereum: EVM.toUpperCase().replace('0X', '0x') }).chainId, 1);
  assert.equal(pickPlatform({ solana: SOL }).chain, 'solana');
  assert.equal(pickPlatform({ robinhood: EVM }).chainId, 4663);
  assert.equal(pickPlatform({ 'x-layer': EVM }).chainId, 196);
  assert.equal(pickPlatform({ hyperevm: EVM }).chainId, 999);
  assert.equal(pickPlatform({ tron: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' }).chainId, 728126428);
  assert.equal(pickPlatform({ hyperliquid: '0x1234' }), null);
  assert.deepEqual(swapPlatforms({ monad: EVM, arc: EVM, plasma: EVM }).map((p) => p.chainId), [143, 5042, 9745]);
  assert.equal(pickPlatform({ ethereum: 'not-an-address' }), null);
  assert.equal(pickPlatform({}), null);
});

test('diffNewCoins returns only ids that were not known', () => {
  const got = diffNewCoins([{ id: 'a' }, { id: 'b' }, { id: 'c' }], new Set(['a', 'c']));
  assert.deepEqual(got.map((c) => c.id), ['b']);
});

test('buildRows: all of the last 24 h newest first, then big coins of the week, 20–30 in total', () => {
  const now = Date.parse('2026-11-15T20:00:00Z');
  const H = 3600e3;
  const fresh = [
    { id: 'old8d', at: now - 8 * 24 * H, chain: 'eth', chainId: 1, address: EVM },
    { id: 'a', at: now - 5 * H, chain: 'eth', chainId: 1, address: EVM },
    { id: 'b', at: now - 1 * H, chain: 'solana', chainId: 1151111081099710, address: SOL },
    { id: 'nodec', at: now - 2 * H, chain: 'eth', chainId: 1, address: EVM },
    { id: 'dead', at: now - 2 * H, chain: 'eth', chainId: 1, address: EVM },
    { id: 'big3d', at: now - 3 * 24 * H, chain: 'base', chainId: 8453, address: EVM },
    { id: 'small3d', at: now - 3 * 24 * H, chain: 'base', chainId: 8453, address: EVM },
    { id: 'mid2d', at: now - 2 * 24 * H, chain: 'bsc', chainId: 56, address: EVM },
  ];
  const mk = (id, vol, extra) => ({ id, symbol: id, name: id, current_price: 1, total_volume: vol, ...extra });
  const markets = [
    mk('old8d', 9e9), mk('a', 2e5, { symbol: 'aaa', image: 'https://x/a.png', price_change_percentage_24h: 12.5 }),
    mk('b', 9e4, { symbol: 'bbb', image: 'http://insecure' }), mk('nodec', 1e6), mk('dead', 10),
    mk('big3d', 5e6), mk('small3d', 2e4), mk('mid2d', 3e5),
  ];
  const dec = new Map([['old8d', 18], ['a', 18], ['b', 9], ['dead', 18], ['big3d', 18], ['small3d', 18], ['mid2d', 18]]);
  const rows = buildRows(fresh, markets, dec, { now });
  assert.deepEqual(rows.map((r) => r.id), ['b', 'a', 'big3d', 'mid2d']);
  assert.equal(rows[0].img, '');
  assert.equal(rows[0].decimals, 9);
  assert.equal(rows[1].chg, 12.5);
  /* Once 20 coins are there, a mid-volume coin of the week is not added. */
  const many = Array.from({ length: 25 }, (_, i) => ({ id: 'n' + i, at: now - (i + 1) * 60e3, chain: 'eth', chainId: 1, address: EVM }));
  const rows2 = buildRows(many.concat(fresh), markets.concat(many.map((f) => mk(f.id, 1e4))), new Map([...dec, ...many.map((f) => [f.id, 18])]), { now });
  assert.equal(rows2.length, 28); // 27 of the last 24 h + 1 big coin of the week; capped at 30
  assert.ok(rows2.some((r) => r.id === 'big3d') && !rows2.some((r) => r.id === 'mid2d'));
});

test('service: first coin list is the baseline, later additions become listings', async () => {
  let t = Date.parse('2026-11-15T10:00:00Z');
  const base = Array.from({ length: 1200 }, (_, i) => ({ id: 'c' + i, symbol: 's' + i, name: 'C' + i, platforms: {} }));
  let list = base;
  const calls = [];
  const get = async (url, opts) => {
    calls.push(url);
    if (url.endsWith('/coins/list')) return { data: list };
    if (url.endsWith('/v1/token')) {
      if (opts.params.chain === 1) return { data: { decimals: 18 } };
      const e = new Error('not routable'); e.response = { status: 400 }; throw e;
    }
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
    { id: 'fallback-net', symbol: 'fb', name: 'Fallback', platforms: { monad: EVM, ethereum: EVM } },
    { id: 'no-chain', symbol: 'l1', name: 'Own L1', platforms: { 'some-l1': '' } },
    { id: 'tesla-xstock', symbol: 'tslax', name: 'Tesla xStock', platforms: { ethereum: EVM } },
  ]);
  t += 31 * 60_000;
  await svc.refreshList();
  t += 6 * 60_000;
  p = await svc.get();
  assert.deepEqual(p.rows.map((r) => r.id).sort(), ['fallback-net', 'fresh-one']);
  assert.ok(p.rows.every((r) => r.chainId === 1 && r.decimals === 18));
  assert.ok(calls.some((u) => u.endsWith('/v1/token')));
});
