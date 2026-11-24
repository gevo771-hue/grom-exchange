import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  RP_ALL, RP_ROUTES, rpFind, routePath, routePageMeta, renderRoutePage, routeSitemapXml, routeSwapInfo,
  routeNotFoundHtml, routeTips, relatedRoutes, createRoutePrices, routeArticleHtml,
} from '../src/market/route-pages.js';
import { rpSide } from '../src/market/route-pages-data.js';
import { ROUTE_COPY } from '../src/market/route-pages-i18n.js';
import { TOKEN_LOCALES } from '../src/market/token-pages-i18n.js';

const CODES = TOKEN_LOCALES.map((l) => l.code);
const PRICES = { ethereum: 3345.12, solana: 138.4, binancecoin: 612.3, tether: 1, 'usd-coin': 0.9999 };
const AT = Date.UTC(2026, 10, 24, 20, 15);
const TEMPLATE = (prefix) => `<html><head><title>__GROM_TOKEN_TITLE__</title><meta name="description" content="__GROM_TOKEN_DESC__">`
  + `<link rel="canonical" href="https://grom.exchange${prefix}/token/__GROM_TOKEN_ID__"><meta property="og:url" content="https://grom.exchange${prefix}/token/__GROM_TOKEN_ID__">`
  + '<!--GROM_TOKEN_HREFLANG--></head><body><!--GROM_TOKEN_ARTICLE--><!--GROM_TOKEN_JSONLD--></body></html>';

test('every route side exists and its address is the one the swap itself uses', () => {
  const swapSrc = fs.readFileSync(new URL('../../frontend/public/grom-wallet.js', import.meta.url), 'utf8')
    + fs.readFileSync(new URL('../../frontend/public/grom-swap-networks.js', import.meta.url), 'utf8');
  const lower = swapSrc.toLowerCase();
  for (const r of RP_ROUTES) {
    for (const key of [r.from, r.to]) {
      const s = rpSide(key);
      assert.ok(s, `${r.slug}: ${key}`);
      if (!/^0x0{40}$/.test(s.address)) assert.ok(lower.includes(s.address.toLowerCase()), `${key} ${s.address} not in the swap token lists`);
    }
  }
});

test('slugs are unique per kind and URL-safe', () => {
  const seen = new Set();
  for (const r of RP_ALL) {
    assert.match(r.slug, /^[a-z0-9][a-z0-9-]{0,79}$/);
    const k = `${r.kind}/${r.slug}`;
    assert.ok(!seen.has(k), k);
    seen.add(k);
  }
});

test('copy exists for every language with the same keys as English', () => {
  const keys = (o, pre = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${pre}${k}.`) : [`${pre}${k}`])).sort();
  const en = keys(ROUTE_COPY.en);
  for (const code of CODES) assert.deepEqual(keys(ROUTE_COPY[code]), en, code);
});

test('every page renders in every language: own URL, title, hreflang, no gaps, no blocked brand names', () => {
  for (const r of RP_ALL) {
    for (const l of TOKEN_LOCALES) {
      const html = renderRoutePage(TEMPLATE(l.prefix), r, { locale: l.code, prices: PRICES, at: AT });
      const url = `https://grom.exchange${routePath(r, l.code)}`;
      assert.ok(html.includes(`<link rel="canonical" href="${url}">`), `${l.code} ${r.slug} canonical`);
      assert.ok(html.includes(`<meta property="og:url" content="${url}">`), `${l.code} ${r.slug} og:url`);
      assert.ok(!html.includes('__GROM_TOKEN'), `${l.code} ${r.slug} placeholder left`);
      assert.equal((html.match(/hreflang=/g) || []).length, CODES.length + 1);
      const text = html.replace(/<script[\s\S]*?<\/script>/g, '');
      assert.ok(!/undefined|NaN|\[object|null/.test(text), `${l.code} ${r.slug}: ${text.match(/.{30}(undefined|NaN|\[object|null).{30}/)?.[0]}`);
      assert.ok(!/hyperliquid|polymarket|kalshi|backed|xstocks/i.test(html), `${l.code} ${r.slug} brand`);
      assert.equal((html.match(/<h1>/g) || []).length, 1);
      const json = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
      assert.deepEqual(json.map((j) => j['@type']), ['WebPage', 'BreadcrumbList', 'FAQPage']);
      assert.equal(json[0].url, url);
    }
  }
});

test('swap pages show an indicative rate, never as a quote; without prices they say it loads in the swap', () => {
  const r = rpFind('swap', 'eth-to-sol');
  const withRate = routeArticleHtml(r, { locale: 'en', prices: PRICES, at: AT });
  assert.match(withRate, /1 ETH ≈ 24\.1699 SOL/);
  assert.match(withRate, /It is not a quote/);
  assert.match(withRate, /20:15 UTC/);
  const ru = routeArticleHtml(r, { locale: 'ru', prices: PRICES, at: AT });
  assert.match(ru, /1 ETH ≈ 24,1699 SOL/);
  assert.match(ru, /Это не котировка/);
  const none = routeArticleHtml(r, { locale: 'en', prices: null, at: AT });
  assert.ok(!/≈/.test(none));
  assert.match(none, /The live ETH\/SOL rate loads in the swap/);
  /* Same asset on two networks: no rate block at all. */
  assert.ok(!/rate today/.test(routeArticleHtml(rpFind('swap', 'usdt-trc20-to-erc20'), { locale: 'en', prices: PRICES, at: AT })));
});

test('notes fit the route', () => {
  assert.deepEqual(routeTips(rpFind('swap', 'usdt-trc20-to-erc20')), ['addr', 'usdtNets', 'tronGas', 'destGas']);
  assert.deepEqual(routeTips(rpFind('swap', 'eth-to-usdt')), ['same']);
  assert.deepEqual(routeTips(rpFind('bridge', 'usdc-ethereum-to-base')), ['destGas']);
  assert.deepEqual(routeTips(rpFind('bridge', 'usdt-ethereum-to-plasma')), ['usdt0', 'fresh', 'destGas']);
  assert.deepEqual(routeTips(rpFind('bridge', 'eth-ethereum-to-robinhood')), ['fresh', 'gasReady']);
  assert.deepEqual(routeTips(rpFind('bridge', 'usdc-base-to-solana')), ['addr', 'destGas']);
});

test('titles: the search phrase people type', () => {
  assert.equal(routePageMeta(rpFind('swap', 'eth-to-sol'), 'en').title, 'Swap ETH to SOL — Ethereum to Solana, no sign-up | GROM');
  assert.equal(routePageMeta(rpFind('bridge', 'usdc-ethereum-to-base'), 'en').title, 'Bridge USDC from Ethereum to Base — fast, no sign-up | GROM');
  assert.equal(routePageMeta(rpFind('alt', 'uniswap'), 'en').title, 'Uniswap alternative — cross-chain swaps from your wallet | GROM');
  assert.match(routePageMeta(rpFind('swap', 'usdt-trc20-to-erc20'), 'ru').title, /^Обменять USDT TRC20 на USDT ERC20/);
  assert.match(routePageMeta(rpFind('alt', 'binance'), 'es').title, /^Alternativa a Binance/);
});

test('related links: other pages only, same kind first', () => {
  const r = rpFind('bridge', 'usdc-ethereum-to-base');
  const rel = relatedRoutes(r);
  assert.equal(rel.length, 10);
  assert.ok(!rel.includes(r));
  assert.ok(rel.slice(0, 5).every((x) => x.kind === 'bridge'));
});

test('sitemap: every page in every language with alternates', () => {
  const xml = routeSitemapXml({ lastmod: '2026-11-24' });
  assert.equal((xml.match(/<loc>/g) || []).length, RP_ALL.length * CODES.length);
  assert.ok(xml.includes('<loc>https://grom.exchange/swap/eth-to-sol</loc>'));
  assert.ok(xml.includes('<loc>https://grom.exchange/pt-BR/bridge/usdc-ethereum-to-base</loc>'));
  assert.ok(xml.includes('<loc>https://grom.exchange/ru/alternatives/uniswap</loc>'));
  assert.ok(xml.includes('hreflang="x-default" href="https://grom.exchange/alternatives/1inch"'));
});

test('swap info for the browser: both sides with chain, address and decimals; title in the page language', () => {
  const info = routeSwapInfo(rpFind('swap', 'eth-to-sol'), 'ru');
  assert.equal(info.path, '/ru/swap/eth-to-sol');
  assert.match(info.title, /^Обменять ETH на SOL/);
  assert.deepEqual([info.from.sym, info.from.chainId, info.from.decimals, info.from.kind], ['ETH', 1, 18, 'evm']);
  assert.deepEqual([info.to.sym, info.to.chainId, info.to.decimals, info.to.kind], ['SOL', 1151111081099710, 9, 'solana']);
  const tron = routeSwapInfo(rpFind('swap', 'usdt-trc20-to-erc20'));
  assert.deepEqual([tron.from.kind, tron.from.address], ['tron', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t']);
  const alt = routeSwapInfo(rpFind('alt', 'jupiter'), 'en');
  assert.equal(alt.from, undefined);
  assert.equal(rpFind('swap', 'nope-to-nothing'), null);
  assert.equal(rpFind('bridge', 'eth-to-sol'), null);
});

test('404 page is noindex and in the right language', () => {
  const html = routeNotFoundHtml('es');
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /href="\/es\/swap"/);
});

test('prices: one CoinGecko call per 10 minutes, last good value kept on errors', async () => {
  let t = 0;
  let calls = 0;
  let fail = false;
  const get = async (url, { params }) => {
    calls++;
    assert.match(url, /\/simple\/price$/);
    assert.match(params.ids, /ethereum/);
    if (fail) throw new Error('429');
    return { data: { ethereum: { usd: 3000 }, solana: { usd: 150 } } };
  };
  const prices = createRoutePrices({ get, now: () => t, apiKey: '' });
  assert.equal((await prices()).prices.ethereum, 3000);
  t = 5 * 60_000;
  await prices();
  assert.equal(calls, 1);
  t = 11 * 60_000;
  fail = true;
  assert.equal((await prices()).prices.solana, 150);
  assert.equal(calls, 2);
  t = 25 * 3_600_000;
  assert.equal((await prices()).prices, null);
});
