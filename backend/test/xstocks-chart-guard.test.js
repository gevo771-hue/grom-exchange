import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getChartCacheEntry,
  registerXstocksChartRoute,
  resolveXstocksChartRequest,
  setBoundedChartCacheEntry,
} from '../src/market/xstocks-chart.js';

const catalog = [
  { sym: 'AAPL', yahooSym: 'AAPL' },
  { sym: 'BRK.B', yahooSym: 'BRK-B' },
];

function registerRoute(options) {
  const registered = {};
  registerXstocksChartRoute({
    get(path, ...handlers) { registered[path] = handlers; },
  }, options);
  assert.equal(registered['/xstocks/chart'].length, 2, 'route must include a limiter and handler');
  return registered['/xstocks/chart'][1];
}

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    set(name, value) { this.headers[name] = value; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('xStock chart resolver only accepts catalog tickers and canonical Yahoo symbols', () => {
  assert.deepEqual(
    resolveXstocksChartRequest({ symbol: 'aapl', yahoo: 'OTHER' }, catalog),
    { symbol: 'AAPL', yahoo: 'AAPL', range: '5d', interval: '15m' },
  );
  assert.deepEqual(
    resolveXstocksChartRequest({ sym: 'brk.b', range: '1d', interval: '5m' }, catalog),
    { symbol: 'BRK.B', yahoo: 'BRK-B', range: '1d', interval: '5m' },
  );
  assert.equal(resolveXstocksChartRequest({ symbol: 'AAPL/../../foo' }, catalog).status, 400);
  assert.equal(resolveXstocksChartRequest({ symbol: 'MSFT' }, catalog).status, 404);
  assert.equal(resolveXstocksChartRequest({ symbol: 'AAPL', range: 'max' }, catalog).status, 400);
  assert.equal(resolveXstocksChartRequest({ symbol: 'AAPL', range: '1d', interval: '1m' }, catalog).status, 400);
  assert.equal(resolveXstocksChartRequest({ symbol: 'BAD' }, [{ sym: 'BAD', yahooSym: 'bad/../path' }]).status, 503);
});

test('chart route blocks arbitrary symbols and coalesces validated upstream requests', async () => {
  let upstreamCalls = 0;
  const handler = registerRoute({
    getCatalog: async () => catalog,
    getSession: async () => null,
    fetchChartData: async ({ yahoo, range, interval }) => {
      upstreamCalls += 1;
      assert.equal(yahoo, 'AAPL');
      assert.equal(range, '1d');
      assert.equal(interval, '5m');
      await new Promise((resolve) => setTimeout(resolve, 15));
      return {
        chart: { result: [{
          timestamp: [1_700_000_000, 1_700_000_300, 1_700_000_600],
          indicators: { quote: [{ close: [100, 0, 102] }] },
          meta: { currency: 'USD', regularMarketPrice: 102 },
        }] },
      };
    },
  });
  const invoke = async (query) => {
    const res = response();
    await handler({ query }, res);
    return res;
  };

  const arbitrary = await invoke({ symbol: 'MSFT', yahoo: 'MSFT' });
  assert.equal(arbitrary.statusCode, 404);
  assert.equal(arbitrary.body.error, 'unknown_xstock');
  assert.equal(upstreamCalls, 0);

  const [first, second] = await Promise.all([
    invoke({ symbol: 'AAPL', yahoo: 'EVIL', range: '1d', interval: '5m' }),
    invoke({ symbol: 'AAPL', yahoo: 'EVIL', range: '1d', interval: '5m' }),
  ]);
  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  const body = first.body;
  assert.equal(body.symbol, 'AAPL');
  assert.equal(body.yahoo, 'AAPL');
  assert.deepEqual(body.points.map((point) => point.c), [100, 102]);
  assert.equal(first.headers['Cache-Control'], 'public, max-age=30, stale-while-revalidate=30');
  assert.equal(upstreamCalls, 1, 'same concurrent chart request should share one upstream fetch');

  const cached = await invoke({ symbol: 'AAPL', range: '1d', interval: '5m' });
  assert.equal(cached.statusCode, 200);
  assert.equal(upstreamCalls, 1, 'cached quote should not refetch upstream');
});

test('chart LRU cache evicts oldest keys and expires stale entries', () => {
  const cache = new Map();
  setBoundedChartCacheEntry(cache, 'a', { ts: 1_000, payload: 'A' }, 2);
  setBoundedChartCacheEntry(cache, 'b', { ts: 1_000, payload: 'B' }, 2);
  assert.equal(getChartCacheEntry(cache, 'a', 1_500, 1_000), 'A');
  setBoundedChartCacheEntry(cache, 'c', { ts: 1_500, payload: 'C' }, 2);
  assert.equal(cache.has('b'), false, 'least-recently-used entry should be evicted');
  assert.equal(getChartCacheEntry(cache, 'a', 2_001, 1_000), null, 'expired entry should not be served');
});
