import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEntry, createTokenPages, renderTokenPage, tokenSitemapXml, relatedTokens, validTokenId,
  tokenPageMeta, PINNED_TOKENS, TOKEN_LOCALES, tokenTemplateUrl, tokenNotFoundHtml,
} from '../src/market/token-pages.js';
import { TOKEN_COPY } from '../src/market/token-pages-i18n.js';
import { SEO_LOCALES } from '../../scripts/seo-locales.mjs';
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

test('sitemap lists every coin page in every language with its hreflang set', () => {
  const xml = tokenSitemapXml([{ id: 'pepe' }, { id: 'bonk' }, { id: 'Bad' }], { lastmod: '2026-11-22' });
  assert.match(xml, /<loc>https:\/\/grom\.exchange\/token\/pepe<\/loc>\n    <lastmod>2026-11-22<\/lastmod>/);
  assert.match(xml, /<loc>https:\/\/grom\.exchange\/ru\/token\/pepe<\/loc>/);
  assert.match(xml, /<loc>https:\/\/grom\.exchange\/pt-BR\/token\/bonk<\/loc>/);
  assert.equal(xml.match(/<loc>/g).length, 2 * TOKEN_LOCALES.length);
  assert.equal(xml.match(/hreflang="x-default" href="https:\/\/grom\.exchange\/token\/pepe"/g).length, TOKEN_LOCALES.length);
  assert.match(xml, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/);
  assert.ok(!xml.includes('Bad'));
});

test('languages: same set and prefixes as the site SEO pages, every text filled', () => {
  assert.deepEqual(TOKEN_LOCALES.map((l) => [l.code, l.prefix]), SEO_LOCALES.map((l) => [l.code, l.prefix]));
  const e = buildEntry({ id: 'pepe', symbol: 'pepe', name: 'Pepe', current_price: 0.0000041, price_change_percentage_24h: -2.5, market_cap_rank: 30, total_volume: 987654321 },
    { ethereum: PEPE, solana: WIF }, ['meme']);
  for (const l of TOKEN_LOCALES) {
    assert.ok(TOKEN_COPY[l.code], l.code);
    const m = tokenPageMeta(e, l.code);
    assert.match(m.title, /PEPE/);
    assert.match(m.title, /\| GROM$/);
    assert.ok(m.description.length > 80 && m.description.length < 200, `${l.code}: ${m.description.length}`);
    assert.ok(!/(^|[^а-яё])акци|Hyperliquid|Polymarket|Kalshi|xStocks|Backed|undefined|null/i.test(m.title + m.description), l.code);
    const html = renderTokenPage(TEMPLATE, e, [], { locale: l.code });
    assert.ok(!/undefined|null|NaN|\$\{/.test(html.replace(/<script[\s\S]*?<\/script>/g, '')), l.code);
    assert.ok(html.includes(`lang="${l.htmlLang}"`), l.code);
    assert.equal((html.match(/<details class="grom-seo-faq-item">/g) || []).length, 3, l.code);
    assert.equal((html.match(/<li>/g) || []).length, 2 + 4, l.code); // networks + steps
  }
});

const TEMPLATE_RU = TEMPLATE.replace('lang="en"', 'lang="ru"').replace('data-grom-locale="en"', 'data-grom-locale="ru"')
  .split('https://grom.exchange/token/__GROM_TOKEN_ID__').join('https://grom.exchange/ru/token/__GROM_TOKEN_ID__')
  .replace('</title>', '</title><!--GROM_TOKEN_HREFLANG-->');

test('page in Russian: own title, links in Russian, hreflang to every language', () => {
  const e = buildEntry({ id: 'pepe', symbol: 'pepe', name: 'Pepe', current_price: 0.0000041, price_change_percentage_24h: -2.5, market_cap_rank: 30, total_volume: 987654321 },
    { ethereum: PEPE, 'binance-smart-chain': '0x25d887ce7a35172c62febfd67a1856f20faebb00' }, ['meme']);
  const bonk = buildEntry({ id: 'bonk', symbol: 'bonk', name: 'Bonk', market_cap_rank: 60 }, { solana: WIF }, ['meme']);
  const html = renderTokenPage(TEMPLATE_RU, e, [bonk], { locale: 'ru', updatedAt: Date.parse('2026-11-22T20:15:00Z') });
  assert.match(html, /<title>Купить PEPE — курс Pepe и кросс-чейн своп \| GROM<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/grom\.exchange\/ru\/token\/pepe" \/>/);
  assert.match(html, /<h1>Pepe \(PEPE\): курс и обмен<\/h1>/);
  assert.match(html, /торгуется по \$0,0000041, падение на 2,50% за 24 часа \(данные CoinGecko, 20:15 UTC\)/);
  assert.match(html, /в сетях Ethereum и BNB Chain/);
  assert.match(html, /<a href="\/ru\/token\/bonk">BONK<\/a>/);
  assert.match(html, /<a href="\/ru\/swap">Swap<\/a>/);
  assert.match(html, /<link rel="alternate" hreflang="es" href="https:\/\/grom\.exchange\/es\/token\/pepe" \/>/);
  assert.match(html, /<link rel="alternate" hreflang="x-default" href="https:\/\/grom\.exchange\/token\/pepe" \/>/);
  assert.equal((html.match(/rel="alternate" hreflang=/g) || []).length, TOKEN_LOCALES.length + 1);
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  assert.equal(ld[0].inLanguage, 'ru');
  assert.equal(ld[0].url, 'https://grom.exchange/ru/token/pepe');
  assert.equal(ld[1].itemListElement[0].item, 'https://grom.exchange/ru/');
  assert.match(ld[2].mainEntity[0].name, /Как купить PEPE без KYC\?/);
  assert.ok(!/(^|[^а-яё])акци/i.test(html)); // «акции» (stocks) — not «транзакцию»
});

test('templates and 404 per language', () => {
  assert.equal(tokenTemplateUrl('en', 'http://frontend/token-template.html'), 'http://frontend/token-template.html');
  assert.equal(tokenTemplateUrl('pt-BR', 'http://frontend/token-template.html'), 'http://frontend/token-template-pt-BR.html');
  assert.equal(tokenTemplateUrl('xx', 'http://frontend/token-template.html'), 'http://frontend/token-template.html');
  assert.match(tokenNotFoundHtml('es'), /<html lang="es">[\s\S]*noindex[\s\S]*Token no encontrado\. <a href="\/es\/swap">/);
  assert.match(tokenNotFoundHtml(), /Token not found\. <a href="\/swap">/);
});

test('swap info: title in the requested language', async () => {
  const { get } = mockGet({ dec: 18 });
  const svc = createTokenPages({ get, pinned: [] });
  assert.match((await svc.swapInfo('pepe', 'tr')).title, /^PEPE Satın Al — Pepe Fiyatı/);
  assert.match((await svc.swapInfo('pepe', 'xx')).title, /^Buy PEPE — /);
});

test('tokenized funds and securities get no page', () => {
  const plat = { ethereum: '0x' + '1'.repeat(40) };
  for (const [id, name] of [['blackrock-usd-institutional-digital-liquidity-fund', 'BlackRock USD Institutional Digital Liquidity Fund'], ['hashnote-usyc', 'Circle USYC'], ['superstate-short-duration-us-government-securities-fund-ustb', 'Superstate Short Duration US Government Securities Fund'], ['spiko-amundi-overnight-swap-fund-eur', 'Spiko Amundi']]) {
    assert.equal(buildEntry({ id, symbol: 'x', name }, plat, ['top']), null, id);
  }
  assert.ok(buildEntry({ id: 'tether', symbol: 'usdt', name: 'Tether' }, plat, ['top']));
});
