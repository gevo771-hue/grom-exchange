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

test('buildRows: all of the last 24 h newest first, then big coins of the last 14 days, 20–30 in total', () => {
  const now = Date.parse('2026-11-15T20:00:00Z');
  const H = 3600e3;
  const fresh = [
    { id: 'old15d', at: now - 15 * 24 * H, chain: 'eth', chainId: 1, address: EVM },
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
    mk('old15d', 9e9), mk('a', 2e5, { symbol: 'aaa', image: 'https://x/a.png', price_change_percentage_24h: 12.5 }),
    mk('b', 9e4, { symbol: 'bbb', image: 'http://insecure' }), mk('nodec', 1e6), mk('dead', 10),
    mk('big3d', 5e6), mk('small3d', 2e4), mk('mid2d', 3e5),
  ];
  const dec = new Map([['old15d', 18], ['a', 18], ['b', 9], ['dead', 18], ['big3d', 18], ['small3d', 18], ['mid2d', 18]]);
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

import { pickDexCandidates, securityOk, buildRows as buildRows2 } from '../src/market/new-listings.js';

test('new listings: DEX top-up keeps only new tokens with real liquidity', () => {
  const now = Date.parse('2026-11-16T14:00:00Z');
  const net = { gt: 'base', chain: 'base', chainId: 8453 };
  const tok = (id, symbol, name, address, decimals = 18) => ({ id, type: 'token', attributes: { symbol, name, address, decimals, image_url: 'https://x/y.png' } });
  const pool = (id, base, quote, { ageH = 10, vol = 500_000, liq = 80_000, px = '0.01' } = {}) => ({
    id, attributes: { pool_created_at: new Date(now - ageH * 3600e3).toISOString(), volume_usd: { h24: String(vol) }, reserve_in_usd: String(liq), base_token_price_usd: px, price_change_percentage: { h24: '12.5' } },
    relationships: { base_token: { data: { id: base } }, quote_token: { data: { id: quote } } },
  });
  const A = '0x' + 'a'.repeat(40), B = '0x' + 'b'.repeat(40), C = '0x' + 'c'.repeat(40), D = '0x' + 'd'.repeat(40), E = '0x' + 'e'.repeat(40), F = '0x' + 'f'.repeat(40);
  const json = {
    included: [
      tok('weth', 'WETH', 'Wrapped Ether', '0x4200000000000000000000000000000000000006'),
      tok('wprl', 'WPRL', 'Obscure', '0x' + '9'.repeat(40)),
      tok('a', 'FROG', 'Frog Coin', A), tok('b', 'PONS', 'Pons', B), tok('c', 'OLD', 'Old Coin', C),
      tok('d', 'Anthropic', 'Anthropic', D), tok('e', 'LATE', 'Late', E), tok('f', 'PEPE', 'Pepe', F),
    ],
    data: [
      pool('p1', 'a', 'weth', { vol: 900_000 }),
      pool('p1b', 'a', 'weth', { vol: 200_000 }),
      pool('p2', 'b', 'wprl', { vol: 5_000_000, liq: 11_000_000 }), // fake liquidity against an obscure token
      pool('p3', 'c', 'weth'), // established coin, new pool
      pool('p4', 'd', 'weth', { vol: 50_000_000 }), // brand name
      pool('p5', 'e', 'weth', { ageH: 24 * 15 }), // older than 14 days
      pool('p6', 'f', 'weth'), // named like a top coin
    ],
  };
  const rows = pickDexCandidates([{ net, json }], { now, oldAddrs: new Set([C]), majorSyms: new Set(['pepe']), majorNames: new Set() });
  assert.deepEqual(rows.map((r) => r.sym), ['FROG']);
  assert.equal(rows[0].vol, 900_000);
  assert.equal(rows[0].chain, 'base');
  assert.equal(rows[0].decimals, 18);
  assert.equal(rows[0].src, 'dex');
});

test('new listings: GoPlus verdict', () => {
  const good = { is_honeypot: '0', sell_tax: '0', buy_tax: '', holder_count: '5000', creator_percent: '0.01' };
  assert.equal(securityOk(8453, good), true);
  assert.equal(securityOk(8453, { ...good, is_honeypot: '1' }), false);
  assert.equal(securityOk(8453, { ...good, sell_tax: '0.25' }), false);
  assert.equal(securityOk(8453, { ...good, holder_count: '17', creator_percent: '0.58' }), false); // PONS-like
  assert.equal(securityOk(8453, null), null);
  assert.equal(securityOk(1151111081099710, { mintable: { status: '0' }, freezable: { status: '0' } }), true);
  assert.equal(securityOk(1151111081099710, { mintable: { status: '1' }, freezable: { status: '0' } }), false);
});

test('new listings: DEX rows only top up to the minimum, never duplicate a CoinGecko coin', () => {
  const now = Date.parse('2026-11-16T14:00:00Z');
  const fresh = [{ id: 'long', at: now - 3600e3, chain: 'bsc', chainId: 56, address: '0x' + '1'.repeat(40) }];
  const markets = [{ id: 'long', symbol: 'long', name: 'Long', current_price: 0.0001, total_volume: 27000 }];
  const dec = new Map([['long', 18]]);
  const dexRow = (i, addr = '0x' + String(i).padStart(40, '0')) => ({ id: 'dex:' + i, sym: 'D' + i, chainId: 8453, address: addr, vol: 1e6 - i, decimals: 18, listedAt: new Date(now).toISOString(), src: 'dex' });
  const dex = [dexRow(1, '0x' + '1'.repeat(40)).chainId === 56 ? null : { ...dexRow(1), chainId: 56, address: '0x' + '1'.repeat(40) }, ...Array.from({ length: 30 }, (_, i) => dexRow(i + 2))];
  const rows = buildRows2(fresh, markets, dec, { now, dex });
  assert.equal(rows.length, 20);
  assert.equal(rows[0].id, 'long');
  assert.equal(rows.filter((r) => String(r.address).toLowerCase() === '0x' + '1'.repeat(40)).length, 1);
});

/* Owner, 17.11: after every deploy the NEW strip was empty for minutes and the CoinGecko baseline
   started over. The snapshot now lives in the database (app_state). */
function memStore(init = {}) {
  const data = new Map(Object.entries(init));
  const writes = [];
  return {
    data, writes,
    get: async (k) => (data.has(k) ? JSON.parse(JSON.stringify(data.get(k))) : null),
    set: async (k, v) => { writes.push(k); data.set(k, JSON.parse(JSON.stringify(v))); return true; },
  };
}

test('new listings: after a restart the saved rows show at once, without waiting for the network', async () => {
  const t = Date.parse('2026-11-17T21:00:00Z');
  const known = Array.from({ length: 1200 }, (_, i) => 'c' + i);
  const store = memStore({
    new_listings_state: { known, fresh: [{ id: 'fresh-one', symbol: 'new', name: 'New One', at: t - 3600e3, chain: 'eth', chainId: 1, address: EVM }], dec: { 'fresh-one': 18 }, listTs: t - 10 * 60_000 },
    new_listings_rows: {
      markets: { ts: t - 20 * 60_000, rows: [{ id: 'fresh-one', symbol: 'new', name: 'New One', image: 'https://img/new', current_price: 2, total_volume: 90_000, price_change_percentage_24h: 5 }] },
      dex: { ts: t - 20 * 60_000, rows: [] },
    },
  });
  const get = async () => new Promise(() => {}); // network never answers
  const svc = createNewListings({ get, now: () => t, file: '', apiKey: '', pause: async () => {}, store, dexOn: false });
  const p = await svc.get();
  assert.deepEqual(p.rows.map((r) => r.sym), ['NEW']);
  assert.equal(p.warming, false);
});

test('new listings: the CoinGecko baseline survives a restart — a coin listed meanwhile is found', async () => {
  let t = Date.parse('2026-11-17T21:00:00Z');
  const base = Array.from({ length: 1200 }, (_, i) => ({ id: 'c' + i, symbol: 's' + i, name: 'C' + i, platforms: {} }));
  const store = memStore({ new_listings_state: { known: base.map((c) => c.id), fresh: [], dec: {}, listTs: t - 40 * 60_000 } });
  const list = base.concat([{ id: 'listed-during-deploy', symbol: 'ldd', name: 'Listed', platforms: { ethereum: EVM } }]);
  const get = async (url, opts) => {
    if (url.endsWith('/coins/list')) return { data: list };
    if (url.endsWith('/v1/token')) return { data: { decimals: 18 } };
    if (url.endsWith('/coins/markets')) return { data: opts.params.ids.split(',').map((id) => ({ id, symbol: id, name: id, image: 'https://img/' + id, current_price: 1, total_volume: 50_000, price_change_percentage_24h: 1 })) };
    throw new Error('unexpected ' + url);
  };
  const svc = createNewListings({ get, now: () => t, file: '', apiKey: '', pause: async () => {}, store, dexOn: false });
  await svc.refreshList();
  assert.deepEqual(svc._state().fresh.map((f) => f.id), ['listed-during-deploy']); // not swallowed into a new baseline
  assert.ok(store.writes.includes('new_listings_state'));
  t += 60_000;
  const p = await svc.get();
  assert.deepEqual(p.rows.map((r) => r.id), ['listed-during-deploy']);
  assert.ok(store.writes.includes('new_listings_rows'));
  assert.equal(store.data.get('new_listings_rows').markets.rows[0].current_price, 1);
});

test('new listings: an empty or broken store is ignored', async () => {
  const store = { get: async () => { throw new Error('relation "app_state" does not exist'); }, set: async () => { throw new Error('down'); } };
  const t = Date.parse('2026-11-17T21:00:00Z');
  const base = Array.from({ length: 1200 }, (_, i) => ({ id: 'c' + i, symbol: 's' + i, name: 'C' + i, platforms: {} }));
  const get = async (url) => { if (url.endsWith('/coins/list')) return { data: base }; return { data: [] }; };
  const svc = createNewListings({ get, now: () => t, file: '', apiKey: '', pause: async () => {}, store, dexOn: false });
  const p = await svc.get();
  assert.equal(p.count, 0);
  assert.equal(svc._state().known.size, 1200);
});
