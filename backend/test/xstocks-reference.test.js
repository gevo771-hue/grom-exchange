import test from 'node:test';
import assert from 'node:assert/strict';
import {
  currentXstockMultiplier,
  registerXstocksReferenceRoute,
  resolveXstockReferenceRequest,
} from '../src/market/xstocks-reference.js';

function registerRoute(options) {
  const routes = {};
  registerXstocksReferenceRoute({
    get(path, ...handlers) { routes[path] = handlers; },
  }, options);
  assert.equal(routes['/xstocks/reference-price'].length, 2);
  return routes['/xstocks/reference-price'][1];
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

async function invoke(handler, query) {
  const res = response();
  await handler({ query }, res);
  return res;
}

const catalog = [{
  sym: 'AAPL', tokenSym: 'AAPLx', solMint: 'So11111111111111111111111111111111111111112',
  fairPrice: 330, fairPriceAt: 1_800_000_000_000,
}];

test('xStock reference lookup accepts only canonical catalog symbols', () => {
  assert.equal(resolveXstockReferenceRequest({ symbol: 'aapl' }, catalog).tokenSym, 'AAPLx');
  assert.equal(resolveXstockReferenceRequest({ symbol: 'AAPLx' }, catalog).symbol, 'AAPL');
  assert.equal(resolveXstockReferenceRequest({ symbol: 'AAPL/../../x' }, catalog).status, 400);
  assert.equal(resolveXstockReferenceRequest({ symbol: 'MSFT' }, catalog).status, 404);
});

test('xStock reference uses official quote and current multiplier, not DEX mid', async () => {
  let priceCalls = 0;
  let multiplierCalls = 0;
  const handler = registerRoute({
    getCatalog: async () => catalog,
    now: () => 1_800_000_000_000,
    fetchPriceData: async ({ tokenSym }) => {
      priceCalls += 1;
      assert.equal(tokenSym, 'AAPLx');
      return { quote: 228.41 };
    },
    fetchMultiplier: async ({ tokenSym, network }) => {
      multiplierCalls += 1;
      assert.equal(tokenSym, 'AAPLx');
      assert.equal(network, 'Solana');
      return { currentMultiplier: 1.2, newMultiplier: 2, activationDateTime: 1_900_000_000 };
    },
  });

  const result = await invoke(handler, { symbol: 'AAPL' });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.fairPrice, 228.41);
  assert.equal(result.body.fairPriceSource, 'xstocks');
  assert.equal(result.body.solMultiplier, 1.2);
  assert.equal(priceCalls, 1);
  assert.equal(multiplierCalls, 1);
});

test('pending multiplier takes effect after its activation time in seconds or milliseconds', () => {
  const now = 1_800_000_000_000;
  assert.equal(currentXstockMultiplier({
    currentMultiplier: 1.2, newMultiplier: 4.8, activationDateTime: 1_900_000_000,
  }, now), 1.2);
  assert.equal(currentXstockMultiplier({
    currentMultiplier: 1.2, newMultiplier: 4.8, activationDateTime: 1_700_000_000,
  }, now), 4.8);
  assert.equal(currentXstockMultiplier({
    currentMultiplier: 2, newMultiplier: 3, activationDateTime: now - 1,
  }, now), 3);
  assert.equal(currentXstockMultiplier({ currentMultiplier: -1 }, now), null);
});

test('reference requests coalesce and cache the public upstream result', async () => {
  let priceCalls = 0;
  const handler = registerRoute({
    getCatalog: async () => catalog,
    now: () => 1_800_000_000_000,
    fetchPriceData: async () => {
      priceCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { quote: 228.41 };
    },
  });
  const [a, b] = await Promise.all([
    invoke(handler, { symbol: 'AAPLx' }),
    invoke(handler, { symbol: 'AAPL' }),
  ]);
  assert.equal(a.body.fairPrice, 228.41);
  assert.deepEqual(b.body, a.body);
  assert.equal(priceCalls, 1);
  await invoke(handler, { symbol: 'AAPL' });
  assert.equal(priceCalls, 1);
});

test('recent USD Yahoo fallback is allowed; stale fallback and unknown symbols fail closed', async () => {
  let calls = 0;
  const handler = registerRoute({
    getCatalog: async () => [
      { ...catalog[0], solMint: '', fairPriceAt: 1_800_000_000_000 },
      { sym: 'ABBV', tokenSym: 'ABBVx', fairPrice: 225, fairPriceAt: 1_799_900_000_000 },
    ],
    now: () => 1_800_000_000_000,
    fetchPriceData: async () => { calls += 1; return { quote: null }; },
  });

  const recent = await invoke(handler, { symbol: 'AAPL' });
  assert.equal(recent.body.fairPrice, 330);
  assert.equal(recent.body.fairPriceSource, 'yahoo-usd');

  const stale = await invoke(handler, { symbol: 'ABBV' });
  assert.equal(stale.statusCode, 503);
  assert.equal(stale.body.error, 'reference_unavailable');
  const unknown = await invoke(handler, { symbol: 'MSFT' });
  assert.equal(unknown.statusCode, 404);
  assert.equal(calls, 2);
});
