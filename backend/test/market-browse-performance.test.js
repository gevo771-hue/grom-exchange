import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { extractSectionInnerHtml } from '../../scripts/seo-public-html.mjs';
import { fetchXstocksCatalogPages } from '../src/market/xstocks-catalog-fetch.js';
const html = readFileSync(new URL('../../frontend/public/index.html', import.meta.url), 'utf8');
const section = (from, to) => html.slice(html.indexOf(from), html.indexOf(to, html.indexOf(from)));

test('lazy admin fragment matches the canonical monitor and nested sections are retained', () => {
  const canonical = extractSectionInnerHtml(html, 'page-backoffice');
  assert.equal(readFileSync(new URL('../../frontend/public/pages/backoffice.html', import.meta.url), 'utf8'), canonical);
  assert.match(canonical, /onclick="boffRecheckHealth\(\)"/);
  assert.equal(extractSectionInnerHtml('<section id="a"><section>nested</section>end</section>', 'a'), '<section>nested</section>end\n');
  assert.throws(() => extractSectionInnerHtml('<section id="a">broken', 'a'), /Unclosed/);
});

test('catalog pagination is bounded, ordered and ignores errors beyond the final page', async () => {
  let active = 0; let peak = 0;
  const nodes = await fetchXstocksCatalogPages(async (page) => {
    peak = Math.max(peak, ++active);
    await new Promise((resolve) => setTimeout(resolve, 6 - page));
    active--;
    if (page > 3) throw new Error('out of range');
    return { nodes: [page], page: { hasNextPage: page < 3 } };
  });
  assert.deepEqual(nodes, [0, 1, 2, 3]);
  assert.equal(peak, 4);
});

test('catalog refuses partial success and page-cap truncation', async () => {
  await assert.rejects(fetchXstocksCatalogPages(async () => ({ error: 'unavailable' })), /Invalid/);
  await assert.rejects(fetchXstocksCatalogPages(async (page) => {
    if (page === 2) throw new Error('upstream unavailable');
    return { nodes: [page], page: { hasNextPage: page < 3 } };
  }), /upstream unavailable/);
  await assert.rejects(fetchXstocksCatalogPages(async () => ({ nodes: [], page: { hasNextPage: true } }), { maxPages: 3 }), /limit/);
});

function priceContext() {
  const stocks = Array.from({ length: 6 }, (_, i) => ({ sym: 'S' + i, listPrice: 123, listPriceAt: Date.now() - 200000 }));
  const cells = new Map(stocks.map((s) => [s.sym, { textContent: '', title: '' }]));
  const rows = stocks.map((s, i) => ({ dataset: { sym: s.sym }, getBoundingClientRect: () => ({ top: i * 100, bottom: i * 100 + 90 }) }));
  const waits = []; let quoted = 0;
  const page = { classList: { contains: () => true }, querySelectorAll: () => rows };
  const ctx = vm.createContext({
    Date, Array, Object, Number, isFinite, Promise,
    window: { innerHeight: 420, gwXstocksQuote: () => { quoted++; } },
    document: { hidden: false, getElementById: () => page, querySelector: (q) => ({ querySelector: () => cells.get(q.match(/data-sym="([^"]+)/)[1]) }) },
    STOCK_MAP: Object.fromEntries(stocks.map((s) => [s.sym, s])), GWX_FAIR_REF_TTL: 60000,
    tx: (_key, fallback) => fallback,
    gwxGetFairReference: (item) => new Promise((resolve) => waits.push({ item, resolve })),
  });
  vm.runInContext(section('  var gwxReferenceQueue =', '  async function refreshUsdtBalChip()'), ctx);
  return { ctx, stocks, cells, waits, quoted: () => quoted };
}

test('visible share prices load without swap routes; requests coalesce at three workers', async () => {
  const { ctx, stocks, cells, waits, quoted } = priceContext();
  ctx.gwxQueueVisibleReferences(); ctx.gwxQueueVisibleReferences();
  assert.equal(waits.length, 3);
  assert.equal(quoted(), 0);
  waits[0].item.fairPriceAt = Date.now();
  waits[0].resolve({ price: 130 });
  await new Promise(setImmediate);
  assert.equal(waits.length, 4);
  assert.equal(stocks[0].listPrice, 130);
  assert.equal(cells.get('S0').textContent, '≈ $130.00');
  assert.match(cells.get('S0').title, /Indicative price per share/);
  waits[1].resolve({ price: 0 });
  await new Promise(setImmediate);
  assert.equal(stocks[1].listPrice, 123, 'an unavailable refresh preserves last observed browsing price');
  assert.equal(waits.length, 5, 'only the five rows inside the viewport are requested');
});

test('list never fabricates a price from DEX mids or expired observations', () => {
  const { ctx } = priceContext();
  assert.equal(ctx.gwxPriceText({ price: 999, fairPrice: 999 }), '—');
  assert.equal(ctx.gwxPriceText({ listPrice: 12, listPriceAt: Date.now() - 25 * 3600000 }), '—');
  assert.equal(ctx.gwxPriceText({ listPrice: Infinity, listPriceAt: Date.now() }), '—');
});

test('price ticks defer painting during scroll and do not redraw hidden trading desks', () => {
  let now = 10000; let pageId = 'page-dashboard';
  const timers = []; const frames = []; const calls = { spot: 0, futures: 0, sync: 0 };
  const ctx = vm.createContext({
    Date: { now: () => now },
    window: { __gwxUserScrolling: now, spotState: {}, futDeskState: {} },
    document: { hidden: false, querySelector: () => ({ id: pageId }) },
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    requestAnimationFrame: (fn) => { frames.push(fn); return frames.length; },
    updateSpotBoard: () => calls.spot++, updateFuturesBoard: () => calls.futures++, syncTradingDeskPrices: () => calls.sync++,
    spotState: {}, futDeskState: {},
  });
  vm.runInContext(section('function gromScheduleMarketUiRefresh()', "window.addEventListener('grom-ws-price'"), ctx);
  ctx.gromScheduleMarketUiRefresh(); ctx.gromScheduleMarketUiRefresh();
  assert.equal(timers.length, 1); assert.equal(frames.length, 0);
  now += 300; timers.shift()(); frames.shift()();
  assert.deepEqual(calls, { spot: 0, futures: 0, sync: 0 });
  pageId = 'page-futures'; now += 600;
  ctx.gromScheduleMarketUiRefresh(); frames.shift()();
  assert.deepEqual(calls, { spot: 0, futures: 1, sync: 1 });
});
