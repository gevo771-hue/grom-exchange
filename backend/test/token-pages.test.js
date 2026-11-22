import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEntry, createTokenPages, renderTokenPage, tokenSitemapXml, relatedTokens, validTokenId,
  tokenPageMeta, PINNED_TOKENS,
} from '../src/market/token-pages.js';
import { LANDING_MEME_TOKENS } from '../../scripts/seo-landing-extra.mjs';

const PEPE = '0x6982508145454Ce325dDbE47a25d4ec3d2311933';
const WIF = 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm';

test('every coin linked from the landing always has a page', () => {
  for (const [id] of LANDING_MEME_TOKENS) assert.ok(PINNED_TOKENS.includes(id), id);
});

test('entry: swap networks in CoinGecko order, pegged copies and unswappable coins skipped', () => {
  const e = buildEntry({ id: 'pepe', symbol: 'pepe', name: 'Pepe', image: 'https://img/pepe', current_price: 0.0000041, price_change_percentage_24h: -2.5, market_cap_rank: 30 },
    { ethereum: PEPE, avalanche: '', aptos: '0x1::pepe', 'binance-smart-chain': '0x25d887ce7a35172c62febfd67a1856f20faebb00' }, ['meme']);
  assert.equal(e.sym, 'PEPE');
  assert.deepEqual(e.chains.map((c) => c.chain), ['eth', 'bsc']);
  assert.equal(e.chains[0].address, PEPE.toLowerCase());
  assert.equal(e.price, 0.0000041);
  assert.equal(buildEntry({ id: 'dogecoin', symbol: 'doge', name: 'Dogecoin' }, {}, ['top']), null);
  assert.equal(buildEntry({ id: 'binance-peg-dogecoin', symbol: 'doge', name: 'Binance-Peg Dogecoin' }, { 'binance-smart-chain': '0xba2ae424d960c26247dd6c32edc70b295c744c43' }, ['meme']), null);
  assert.equal(buildEntry({ id: 'Bad Id', symbol: 'x' }, { ethereum: PEPE }, ['top']), null);
});

test('ids: only lower-case CoinGecko slugs', () => {
  assert.ok(validTokenId('pepe') && validTokenId('based-brett') && validTokenId('spx6900'));
  assert.ok(!validTokenId('PEPE') && !validTokenId('../etc') && !validTokenId('') && !validTokenId('-x'));
});

function mockGet({ dec = 18, lifiFail = false } = {}) {
  const calls = [];
  const get = async (url, opts = {}) => {
    calls.push(url + (opts.params ? ' ' + JSON.stringify(opts.params) : ''));
    if (url.endsWith('/coins/list')) {
      const list = Array.from({ length: 1200 }, (_, i) => ({ id: 'c' + i, platforms: {} }));
      list.push({ id: 'pepe', platforms: { ethereum: PEPE } }, { id: 'dogwifcoin', platforms: { solana: WIF } }, { id: 'bitcoin', platforms: {} });
      return { data: list };
    }
    if (url.endsWith('/coins/markets')) {
      const p = opts.params || {};
      if (p.category === 'meme-token') return { data: [{ id: 'pepe', symbol: 'pepe', name: 'Pepe', current_price: 0.000004, market_cap_rank: 30 }, { id: 'dogwifcoin', symbol: 'wif', name: 'dogwifhat', current_price: 1.2, market_cap_rank: 80 }] };
      if (p.ids) return { data: p.ids.split(',').filter((id) => id === 'pepe').map((id) => ({ id, symbol: id, name: 'Pepe' })) };
      return { data: [{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', market_cap_rank: 1 }, { id: 'pepe', symbol: 'pepe', name: 'Pepe', market_cap_rank: 30 }] };
    }
    if (url.endsWith('/v1/token')) {
      if (lifiFail) { const e = new Error('404'); e.response = { status: 404 }; throw e; }
      return { data: { decimals: dec } };
    }
    throw new Error('unexpected ' + url);
  };
  return { get, calls };
}

test('service: memes + top + pinned + NEW, swappable only; swap info with LI.FI decimals', async () => {
  const { get, calls } = mockGet({ dec: 6 });
  const svc = createTokenPages({
    get, pinned: ['pepe'],
    newRows: async () => [{ id: 'fresh-coin', sym: 'frsh', name: 'Fresh', logo: '', price: 0.1, chg: 50, chain: 'base', chainId: 8453, address: '0x' + 'f'.repeat(40) }],
  });
  const list = await svc.list();
  assert.deepEqual(list.map((e) => e.id).sort(), ['dogwifcoin', 'fresh-coin', 'pepe']);
  const pepe = await svc.get('pepe');
  assert.deepEqual(pepe.kinds, ['meme', 'pinned', 'top']);
  assert.equal((await svc.get('fresh-coin')).kinds[0], 'new');
  assert.equal(await svc.get('bitcoin'), null); // no contract on a swap network
  assert.equal(await svc.get('../x'), null);
  const info = await svc.swapInfo('dogwifcoin');
  assert.equal(info.chainId, 1151111081099710);
  assert.equal(info.address, WIF);
  assert.equal(info.decimals, 6);
  assert.match(info.title, /^Buy WIF — dogwifhat Price/);
  await svc.swapInfo('dogwifcoin');
  assert.equal(calls.filter((c) => c.includes('/v1/token')).length, 1); // decimals cached
  assert.equal(calls.filter((c) => c.includes('/coins/list')).length, 1);
});

test('service: unknown decimals → no preselect value; snapshot restores pages before CoinGecko answers', async () => {
  const { get } = mockGet({ lifiFail: true });
  const saved = new Map();
  const store = { get: async (k) => saved.get(k) || null, set: async (k, v) => { saved.set(k, JSON.parse(JSON.stringify(v))); } };
  const svc = createTokenPages({ get, pinned: [], store });
  assert.equal((await svc.swapInfo('pepe')).decimals, null);
  await new Promise((r) => setImmediate(r));
  assert.ok(saved.get('token_pages').entries.length >= 2);
  const offline = createTokenPages({ get: async () => { throw new Error('offline'); }, store });
  assert.equal((await offline.get('pepe')).sym, 'PEPE');
});

const TEMPLATE = '<!doctype html><html lang="en" data-grom-route="dashboard" data-grom-locale="en"><head><title>__GROM_TOKEN_TITLE__</title>'
  + '<meta name="description" content="__GROM_TOKEN_DESC__" /><link rel="canonical" href="https://grom.exchange/token/__GROM_TOKEN_ID__" />'
  + '<meta property="og:url" content="https://grom.exchange/token/__GROM_TOKEN_ID__" /></head><body><main><!--GROM_TOKEN_ARTICLE--></main><!--GROM_TOKEN_JSONLD--></body></html>';

test('page: title, canonical, article and JSON-LD per coin; names are escaped', () => {
  const e = buildEntry({ id: 'evil-coin', symbol: 'ev"<', name: '<script>alert(1)</script>', current_price: 0.5, price_change_percentage_24h: 12.345, market_cap_rank: 99, total_volume: 1234567 },
    { base: '0x' + 'a'.repeat(40), solana: WIF }, ['meme']);
  const other = buildEntry({ id: 'pepe', symbol: 'pepe', name: 'Pepe', market_cap_rank: 30 }, { ethereum: PEPE }, ['meme']);
  const html = renderTokenPage(TEMPLATE, e, relatedTokens(e, [e, other]), { updatedAt: Date.parse('2026-11-22T20:15:00Z') });
  assert.ok(!html.includes('__GROM_TOKEN') && !html.includes('<!--GROM_TOKEN'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /<link rel="canonical" href="https:\/\/grom\.exchange\/token\/evil-coin" \/>/);
  assert.match(html, /<title>Buy EV&quot;&lt; — &lt;script&gt;/);
  assert.match(html, /up 12\.35% over the last 24 hours \(CoinGecko data, 20:15 UTC\)/);
  assert.match(html, /Base: <code>0xaaaa/);
  assert.match(html, /Solana: <code>EKpQ/);
  assert.match(html, /<a href="\/token\/pepe">PEPE<\/a>/);
  assert.match(html, /Meme coins are highly volatile/);
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  assert.deepEqual(ld.map((x) => x['@type']), ['WebPage', 'BreadcrumbList', 'FAQPage']);
  assert.equal(ld[0].url, 'https://grom.exchange/token/evil-coin');
  assert.ok(!/Hyperliquid|Polymarket|Kalshi|xStocks|Backed/i.test(html));
});

test('meta: networks named, no prices in the description (snippets go stale)', () => {
  const e = buildEntry({ id: 'pepe', symbol: 'pepe', name: 'Pepe', current_price: 0.0000041 }, { ethereum: PEPE, 'binance-smart-chain': '0x25d887ce7a35172c62febfd67a1856f20faebb00', base: '0x' + 'b'.repeat(40), 'arbitrum-one': '0x' + 'c'.repeat(40) }, ['meme']);
  const m = tokenPageMeta(e);
  assert.equal(m.title, 'Buy PEPE — Pepe Price & Cross-Chain Swap | GROM');
  assert.equal(m.description, 'Swap or buy PEPE on Ethereum, BNB Chain, Base and more from your own wallet. Live PEPE price, 24h change and contract addresses. No sign-up, no deposit.');
  assert.ok(!/\d\.\d/.test(m.description));
});

test('sitemap lists every coin page', () => {
  const xml = tokenSitemapXml([{ id: 'pepe' }, { id: 'bonk' }, { id: 'Bad' }], { lastmod: '2026-11-22' });
  assert.match(xml, /<loc>https:\/\/grom\.exchange\/token\/pepe<\/loc>\n    <lastmod>2026-11-22<\/lastmod>/);
  assert.match(xml, /token\/bonk/);
  assert.ok(!xml.includes('Bad'));
});

test('tokenized funds and securities get no page', () => {
  const plat = { ethereum: '0x' + '1'.repeat(40) };
  for (const [id, name] of [['blackrock-usd-institutional-digital-liquidity-fund', 'BlackRock USD Institutional Digital Liquidity Fund'], ['hashnote-usyc', 'Circle USYC'], ['superstate-short-duration-us-government-securities-fund-ustb', 'Superstate Short Duration US Government Securities Fund'], ['spiko-amundi-overnight-swap-fund-eur', 'Spiko Amundi']]) {
    assert.equal(buildEntry({ id, symbol: 'x', name }, plat, ['top']), null, id);
  }
  assert.ok(buildEntry({ id: 'tether', symbol: 'usdt', name: 'Tether' }, plat, ['top']));
});
