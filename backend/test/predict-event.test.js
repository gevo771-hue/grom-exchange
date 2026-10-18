import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePredictionEvent, normalizePredictionHistory, registerPredictionEventRoutes } from '../src/market/predict-event.js';

const fixture = () => ({ id: '123', title: 'Test event', active: true, endDate: '2099-01-01', volume: '900', volume24hr: '12', markets: [
  { id: '10', question: 'Outcome A', groupItemTitle: 'A', outcomes: '["Yes","No"]', outcomePrices: '["0.001","0.999"]', clobTokenIds: '["111","222"]', active: true, enableOrderBook: true, acceptingOrders: true, orderPriceMinTickSize: .001 },
  { id: '11', question: 'Outcome B', outcomes: '["No","Yes"]', outcomePrices: '["1","0"]', clobTokenIds: '["333","444"]', closed: true },
] });
test('details preserve near-certain and closed outcomes, separate 24h volume, and side token mapping', () => {
  const e = normalizePredictionEvent(fixture());
  assert.equal(e.rows.length, 2); assert.equal(e.vol, 900); assert.equal(e.vol24, 12);
  assert.equal(e.rows[0].p, .1); assert.equal(e.rows[0].tradeable, true);
  assert.equal(e.rows[1].p, 0); assert.equal(e.rows[1].tokenYes, '444'); assert.equal(e.rows[1].tradeable, false);
});
test('missing or malformed prices are unknown, never zero or a fabricated 50%', () => {
  const raw = fixture(); raw.markets[0].outcomePrices = '[null,""]';
  const row = normalizePredictionEvent(raw).rows[0];
  assert.equal(row.p, null); assert.equal(row.pNo, null); assert.equal(row.tradeable, false);
});
test('closed, expired, nonbinary and unaccepting markets cannot expose trade buttons', () => {
  for (const change of [{ acceptingOrders: false }, { endDate: '2020-01-01' }, { closed: true }, { outcomes: '["A","B","C"]' }, { enableOrderBook: false }]) {
    const raw = fixture(); Object.assign(raw.markets[0], change);
    assert.equal(normalizePredictionEvent(raw).rows[0].tradeable, false);
  }
});
test('source URLs reject executable protocols and embedded credentials', () => {
  const raw = fixture(); raw.image = 'javascript:alert(1)'; raw.resolutionSource = 'https://user:secret@example.com';
  const e = normalizePredictionEvent(raw); assert.equal(e.img, ''); assert.equal(e.resolutionSource, '');
});
test('history keeps zero and one, removes invalid data, sorts and deduplicates', () => {
  assert.deepEqual(normalizePredictionHistory({ history: [{ t: 2, p: 1 }, { t: 1, p: 0 }, { t: 2, p: .3 }, { t: 3, p: null }, { t: 4, p: 4 }] }), [{ t: 1, p: 0 }, { t: 2, p: .3 }]);
  assert.throws(() => normalizePredictionHistory({ error: 'upstream' }));
  const data = Array.from({ length: 5000 }, (_, i) => ({ t: i + 1, p: .5 }));
  const out = normalizePredictionHistory({ history: data });
  assert.equal(out.length, 2000); assert.equal(out[0].t, 1); assert.equal(out.at(-1).t, 5000);
});
function harness(options) {
  const routes = {};
  registerPredictionEventRoutes({ get(path, ...handlers) { routes[path] = handlers.at(-1); } }, options);
  return async (path, params = {}, query = {}) => {
    const res = { statusCode: 200, set() { return this; }, status(n) { this.statusCode = n; return this; }, json(value) { this.body = value; return this; } };
    await routes[path]({ params, query }, res); return res;
  };
}
test('invalid ids, tokens and intervals never reach the upstream', async () => {
  let calls = 0; const call = harness({ get: async () => { calls++; } });
  for (const id of ['../admin', '0', '123?key=x', 'https://x']) assert.equal((await call('/predict/event/:id', { id })).statusCode, 400);
  for (const query of [{ token: ['123'] }, { token: '123', range: 'constructor' }, { token: '123', range: ['1d'] }, { token: 'https://x' }]) assert.equal((await call('/predict/history', {}, query)).statusCode, 400);
  assert.equal(calls, 0);
});
test('coalesces concurrent reads and expires cache; network options are bounded and fixed-host', async () => {
  let calls = 0, now = 100000;
  const call = harness({ now: () => now, get: async (url, options) => {
    calls++; assert.equal(url, 'https://gamma-api.polymarket.com/events/123'); assert.equal(options.maxRedirects, 0); assert.equal(options.timeout, 12000);
    await new Promise(resolve => setTimeout(resolve, 5)); return { data: fixture() };
  } });
  await Promise.all([call('/predict/event/:id', { id: '123' }), call('/predict/event/:id', { id: '123' })]);
  assert.equal(calls, 1); await call('/predict/event/:id', { id: '123' }); assert.equal(calls, 1);
  now += 31000; await call('/predict/event/:id', { id: '123' }); assert.equal(calls, 2);
});
test('upstream failures are not cached or misrepresented as empty success', async () => {
  let calls = 0; const call = harness({ get: async () => { if (++calls === 1) throw new Error('timeout'); return { data: { history: [] } }; } });
  const req = () => call('/predict/history', {}, { token: '111', range: '1w' });
  assert.equal((await req()).statusCode, 503); assert.deepEqual((await req()).body.history, []); assert.equal(calls, 2);
});
test('mismatched event id is rejected', async () => {
  const call = harness({ get: async () => ({ data: { ...fixture(), id: '124' } }) });
  assert.equal((await call('/predict/event/:id', { id: '123' })).statusCode, 503);
});

test('localized text cannot remap token sides or override canonical prices', async () => {
  const call = harness({ get: async (_url, options) => {
    const raw = fixture();
    if (options.params.locale) { raw.title = 'Localized'; raw.markets[0].question = 'Translated'; raw.markets[0].outcomes = '["No translated","Yes translated"]'; raw.markets[0].clobTokenIds = '["999","888"]'; raw.markets[0].outcomePrices = '["0.9","0.1"]'; }
    return { data: raw };
  } });
  const result = await call('/predict/event/:id', { id: '123' }, { lang: 'ru' });
  assert.equal(result.body.q, 'Localized'); assert.equal(result.body.rows[0].question, 'Translated');
  assert.equal(result.body.rows[0].tokenYes, '111'); assert.equal(result.body.rows[0].p, .1); assert.equal(result.body.rows[0].tradeable, true);
});
