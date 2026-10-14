import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createPulseController, trackProbe } from '../src/activity/diagnostics.js';

const pulseSource = readFileSync(new URL('../src/activity/health-pulse.js', import.meta.url), 'utf8');
const proxySource = readFileSync(new URL('../src/futures/hl-routes.js', import.meta.url), 'utf8');
const script = source => source.replace(/^import .*;$/gm, '').replace(/^export default .*;$/gm, '').replace(/^export /gm, '');
const start = Date.parse('2026-10-14T05:00:00Z');
function clock() {
  let now = start;
  return { Date: class extends Date { static now() { return now; } }, advance(ms) { now += ms; } };
}
function harness(response, { testnet = false } = {}) {
  const time = clock(), calls = [], logs = [];
  const context = vm.createContext({ Date: time.Date, Promise, Map, process: { env: {} },
    config: { hyperliquid: { testnet } }, createPulseController, trackProbe,
    axios: { post: async (url, body) => { calls.push({ url, body }); return response(body); } },
    classifyIssue: () => ({ severity: 'error' }), logUserActivity: async row => logs.push(row),
    logger: { warn() {} },
  });
  vm.runInContext(script(pulseSource), context);
  return { context, calls, logs, time };
}
const data = body => body.type === 'allMids'
  ? Object.fromEntries(Array.from({ length: 30 }, (_, i) => [i, '1']))
  : [{ universe: Array(30).fill({}) }];
for (const name of ['probeHyperliquid', 'probeHip3']) {
  test(name + ': stale-on-429 HTTP 200 cannot report current success', async () => {
    const h = harness(body => ({ status: 200, data: data(body), headers: { 'x-grom-hl-cache': 'stale-on-429' } }));
    const result = await h.context[name]();
    assert.equal(result.ok, false);
    assert.equal(result.severity, 'warn');
    assert.match(result.message, /429/);
  });
  test(name + ': proxy hits preserve observation time and cannot clear a failure streak', async () => {
    const observed = new Date(start - 10000).toISOString();
    const h = harness(body => ({ status: 200, data: data(body), headers: {
      'x-grom-hl-cache': 'hit', 'x-grom-hl-observed-at': observed,
    } }));
    const result = await h.context[name]();
    assert.equal(result.verification, 'cached');
    assert.equal(result.observed_at, observed);
    const tracked = trackProbe(result, { consecutive_failures: 2 }, start);
    assert.equal(tracked.consecutive_failures, 2);
    assert.equal(tracked.recovered, false);
    h.time.advance(1000);
    await h.context[name]();
    assert.equal(h.calls.length, 2, 'proxy data must not reset the probe success cache');
  });
  test(name + ': forced check contacts the configured upstream and retains HTTP 429', async () => {
    const h = harness(() => ({ status: 429 }), { testnet: true });
    const result = await h.context[name](true);
    assert.equal(result.ok, false);
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].url, 'https://api.hyperliquid-testnet.xyz/info');
  });
}

test('cached success does not reset health incident reminder suppression', async () => {
  const h = harness(() => ({}));
  const failure = { id: 'hl', ok: false, severity: 'warn', message: 'HL HTTP 429' };
  await h.context.maybeLogIssue(failure);
  await h.context.maybeLogIssue({ id: 'hl', ok: true, verification: 'cached' });
  await h.context.maybeLogIssue(failure);
  assert.equal(h.logs.length, 1);
});

test('HL proxy reports the original upstream observation for fresh, cached and stale data', async () => {
  const routes = new Map(), time = clock();
  let status = 200, calls = 0;
  const context = vm.createContext({ Date: time.Date, Map, Set, process: { env: {} }, config: {},
    express: { Router: () => ({ get() {}, post(path, handler) { routes.set(path, handler); } }) },
    axios: { post: async (_url, body) => { calls++; return { status, data: data(body) }; } },
  });
  vm.runInContext(script(proxySource), context);
  context.createHlFuturesRouter();
  async function request() {
    const res = { headers: {}, status(value) { this.statusCode = value; return this; },
      set(name, value) { this.headers[name.toLowerCase()] = value; return this; }, json(value) { this.data = value; return this; } };
    await routes.get('/info')({ body: { type: 'allMids' } }, res);
    return res;
  }
  const live = await request();
  assert.equal(live.headers['x-grom-hl-cache'], 'miss');
  const observed = new Date(start).toISOString();
  assert.equal(live.headers['x-grom-hl-observed-at'], observed);
  time.advance(1000);
  const cached = await request();
  assert.equal(cached.headers['x-grom-hl-cache'], 'hit');
  assert.equal(cached.headers['x-grom-hl-observed-at'], observed);
  assert.equal(calls, 1);
  time.advance(2000); status = 429;
  const stale = await request();
  assert.equal(stale.statusCode, 200, 'market UI may retain the last known data');
  assert.equal(stale.headers['x-grom-hl-cache'], 'stale-on-429');
  assert.equal(stale.headers['x-grom-hl-observed-at'], observed);
  assert.equal(calls, 2);
});


test('stock catalog cache is availability evidence, never a fresh upstream recovery', async () => {
  let requests = 0;
  const h = harness(() => ({}));
  h.context.axios.get = async () => { requests++; return { status: 200,
    data: { items: Array(50).fill({ solMint: 'mint' }), cached: true, refreshing: true } }; };
  const result = await h.context.probeXstocks(true);
  assert.equal(result.ok, true);
  assert.equal(result.verification, 'cached');
  const tracked = trackProbe(result, { consecutive_failures: 2 }, start);
  assert.equal(tracked.observed_at, null, 'unknown catalog age is not stamped as now');
  assert.equal(tracked.recovered, false);
  assert.equal(tracked.consecutive_failures, 2);
  await h.context.probeXstocks();
  assert.equal(requests, 2, 'cached catalog does not restart the live-success timer');
});

test('cached catalog carrying an upstream error remains a warning', async () => {
  const h = harness(() => ({}));
  h.context.axios.get = async () => ({ status: 200,
    data: { items: Array(50).fill({ solMint: 'mint' }), cached: true, error: 'upstream' } });
  const result = await h.context.probeXstocks(true);
  assert.equal(result.ok, false);
  assert.equal(result.severity, 'warn');
});


for (const name of ['probeHyperliquid', 'probeHip3']) {
  test(name + ': missing or future cache timestamps remain unknown', async () => {
    for (const observed of [undefined, new Date(start + 1000).toISOString(), 'invalid']) {
      const h = harness(body => ({ status: 200, data: data(body), headers: {
        'x-grom-hl-cache': 'hit', 'x-grom-hl-observed-at': observed,
      } }));
      const tracked = trackProbe(await h.context[name](), null, start);
      assert.equal(tracked.verification, 'cached');
      assert.equal(tracked.observed_at, null);
    }
  });
  test(name + ': forced upstream transport failure is not sent a second time', async () => {
    const h = harness(() => { throw new Error('connection timeout'); });
    const result = await h.context[name](true);
    assert.equal(result.ok, false);
    assert.equal(h.calls.length, 1);
  });
}
