import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { selectFeaturedPredictions } from '../src/market/predict-featured.js';

const all = [
  { id: 'p1', cat: 'politics', vol: 100 }, { id: 'p2', cat: 'politics', vol: 95 },
  { id: 's1', cat: 'sport', vol: 80 }, { id: 'c1', cat: 'crypto', vol: 70 },
  { id: 'e1', cat: 'economy', vol: 60 },
];
test('featured selection is deterministic, category-diverse, and independent of input order', () => {
  assert.deepEqual(selectFeaturedPredictions(all).map(m => m.id), ['p1', 's1', 'c1', 'e1']);
  assert.deepEqual(selectFeaturedPredictions([...all].reverse()), selectFeaturedPredictions(all));
  assert.equal(all[1].id, 'p2');
  const tied = [{ id: 'b', cat: 'sport', vol: 3 }, { id: 'a', cat: 'sport', vol: 3 }];
  assert.deepEqual(selectFeaturedPredictions(tied, 3).map(m => m.id), ['a', 'b']);
  assert.deepEqual(selectFeaturedPredictions([all[0], all[0]], 4), [all[0]]);
});
const html = readFileSync(new URL('../../frontend/public/index.html', import.meta.url), 'utf8');
const begin = html.indexOf('  var gwxFeatured =');
const finish = html.indexOf('  setInterval(function () {', begin);
function harness(mobile = false) {
  let lang = 'en', stamp = 1_800_000_000_000, paints = 0;
  const calls = [], responses = [];
  const ctx = vm.createContext({
    AbortController, encodeURIComponent, Promise,
    Date: { now: () => stamp },
    gwxCurrentLang: () => lang,
    gwxMobile: () => mobile, window: { GROM_SAFARI: mobile },
    GWX_LIVE: [{ id: 'unrelated-search' }], GWX_CATALOG: all,
    setTimeout: () => 1, clearTimeout() {},
    renderPredictWidgets() { paints++; },
    fetch(url) {
      calls.push(url);
      return new Promise((resolve, reject) => responses.push({ resolve, reject }));
    },
  });
  vm.runInContext(html.slice(begin, finish), ctx);
  return { ctx, calls, responses, setLang(v) { lang = v; }, advance(ms) { stamp += ms; }, get paints() { return paints; } };
}
test('desktop and Safari/mobile request the same selection; browsing cannot change homepage cards', async () => {
  for (const mobile of [false, true]) {
    const h = harness(mobile);
    const a = h.ctx.loadFeaturedPredictions(), b = h.ctx.loadFeaturedPredictions();
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0], '/api/market/predict?featured=1&lang=en');
    h.responses[0].resolve({ ok: true, json: async () => ({ markets: all.slice(0, 3) }) });
    await Promise.all([a, b]);
    h.ctx.GWX_LIVE = [{ id: 'filtered-category' }];
    assert.equal(JSON.stringify(h.ctx.predictWidgetSource()), JSON.stringify(all.slice(0, 3)));
    await h.ctx.loadFeaturedPredictions();
    assert.equal(h.calls.length, 1);
  }
});
test('locale changes discard the old response and fetch the new language', async () => {
  const h = harness();
  const first = h.ctx.loadFeaturedPredictions();
  h.setLang('ru');
  h.responses[0].resolve({ ok: true, json: async () => ({ markets: all }) });
  await first;
  assert.equal(h.calls[1], '/api/market/predict?featured=1&lang=ru');
  assert.equal(h.ctx.predictWidgetSource().length, 0);
  const second = h.ctx.loadFeaturedPredictions();
  h.responses[1].resolve({ ok: true, json: async () => ({ markets: [{ id: 'ru-event' }] }) });
  await second;
  assert.equal(h.ctx.predictWidgetSource()[0].id, 'ru-event');
});
test('failed featured request does not loop or publish demo odds and can retry later', async () => {
  const h = harness();
  const first = h.ctx.loadFeaturedPredictions();
  h.responses[0].reject(new Error('offline'));
  await first;
  await h.ctx.loadFeaturedPredictions();
  assert.equal(h.calls.length, 1);
  assert.equal(h.ctx.predictWidgetSource().length, 0);
  h.advance(16000);
  const retry = h.ctx.loadFeaturedPredictions();
  h.responses[1].resolve({ ok: true, json: async () => ({ markets: all }) });
  await retry;
  assert.equal(h.ctx.predictWidgetSource().length, all.length);
});

test('localized labels cannot change featured identities, categories, order, prices or token sides', async () => {
  const { localizeFeaturedPredictions } = await import('../src/market/predict-featured.js');
  const canonical = [{ id: 'p1', cat: 'politics', q: 'Election', vol: 10, rows: [
    { marketId: 'm1', n: 'Alice', p: 60, tokenYes: 'a', tokenNo: 'b' },
    { marketId: 'm2', n: 'Bob', p: 40, tokenYes: 'c', tokenNo: 'd' },
  ] }, { id: 's1', q: 'Sport' }];
  const localized = [{ id: 'p1', cat: 'esports', q: 'Выборы', vol: 99, rows: [
    { marketId: 'm2', n: 'Боб', p: 80, tokenYes: 'wrong' },
    { marketId: 'm1', n: 'Алиса', p: 20, tokenNo: 'wrong' },
  ] }, { id: 'unrelated', q: 'Other event' }];
  const result = localizeFeaturedPredictions(canonical, localized);
  assert.deepEqual(result.map(m => m.id), ['p1', 's1']);
  assert.equal(result[0].cat, 'politics');
  assert.equal(result[0].q, 'Выборы');
  assert.deepEqual(result[0].rows, [
    { marketId: 'm1', n: 'Алиса', p: 60, tokenYes: 'a', tokenNo: 'b' },
    { marketId: 'm2', n: 'Боб', p: 40, tokenYes: 'c', tokenNo: 'd' },
  ]);
  assert.equal(result[1], canonical[1]);
});

test('all locales share one coalesced snapshot during progressive catalog loading', async () => {
  const { createFeaturedPredictionLoader } = await import('../src/market/predict-featured.js');
  let stamp = 1_800_000_000_000, loads = 0, translations = 0, resolve;
  const load = createFeaturedPredictionLoader({ now: () => stamp, ttl: 100,
    getCatalog: () => { loads++; return new Promise(r => { resolve = r; }); },
    translate: async () => { translations++; return [{ id: 'p2', q: 'Разница', cat: 'economy', vol: 1000 }]; },
  });
  const en = load('en'), ru = load('ru'), ru2 = load('ru');
  assert.equal(loads, 1);
  resolve({ markets: all });
  const results = await Promise.all([en, ru, ru2]);
  assert.deepEqual(results.map(r => r.markets.map(m => m.id)), Array(3).fill(['p1', 's1', 'c1', 'e1']));
  assert.equal(translations, 1);
  await load('es');
  assert.equal(loads, 1);
  stamp += 101;
  const refresh = load('en');
  resolve({ markets: [all[1]] });
  assert.deepEqual((await refresh).markets.map(m => m.id), ['p2']);
});

test('failed translation keeps canonical cards and expired cards are removed even within the snapshot', async () => {
  const { createFeaturedPredictionLoader } = await import('../src/market/predict-featured.js');
  let stamp = Date.parse('2026-10-28T00:00:00Z');
  const load = createFeaturedPredictionLoader({ now: () => stamp,
    getCatalog: async () => ({ markets: [{ ...all[0], endsAt: new Date(stamp + 1000).toISOString() }] }),
    translate: async () => { throw new Error('upstream'); },
  });
  assert.equal((await load('ru')).markets[0].id, 'p1');
  stamp += 1001;
  assert.deepEqual((await load('ru')).markets, []);
});
