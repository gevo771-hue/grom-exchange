import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import axios from 'axios';
import { axelarPayload, sourceHash } from './fixtures/axelar-squid.js';

test('Axelar HTTP recovery validates input, preserves errors and limits upstream requests', async (t) => {
  // Import the actual router without starting unrelated prediction-catalog
  // warmers. Restore timers before exercising HTTP and rate limiting.
  const setTimeoutReal = globalThis.setTimeout;
  const timeoutMock = t.mock.method(globalThis, 'setTimeout', (fn, ms, ...args) =>
    setTimeoutReal(ms === 1500 ? () => {} : fn, ms === 1500 ? 0 : ms, ...args));
  const intervalMock = t.mock.method(globalThis, 'setInterval', () => setTimeoutReal(() => {}, 0));
  const { createMarketRouter } = await import('../src/market/routes.js');
  timeoutMock.mock.restore();
  intervalMock.mock.restore();
  let calls = 0;
  let unavailable = false;
  t.mock.method(axios, 'get', async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.axelarscan.io/gmp/searchGMP');
    assert.equal(options.params.txHash, sourceHash);
    if (unavailable) throw new Error('private upstream diagnostics');
    return { status: 200, data: axelarPayload() };
  });
  const app = express();
  app.use('/api/market', createMarketRouter());
  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/market/bridge/axelar/status`;
  for (const query of ['', '?txHash=bad', '?txHash=https://attacker.example', `?txHash=${sourceHash}&txHash=${sourceHash}`]) {
    const response = await fetch(base + query);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(calls, 0);
  const success = await fetch(`${base}?txHash=${sourceHash}`);
  assert.equal(success.status, 200);
  assert.equal(success.headers.get('cache-control'), 'no-store');
  const evidence = await success.json();
  assert.equal(evidence.outcome, 'destination_check');
  assert.equal(evidence.sourceTxHash, sourceHash);
  unavailable = true;
  const failure = await fetch(`${base}?txHash=${sourceHash}`);
  assert.equal(failure.status, 502);
  assert.deepEqual(await failure.json(), { error: 'axelar_status_unavailable' });
  unavailable = false;
  let limited = false;
  for (let i = 0; i < 60; i++) {
    const response = await fetch(`${base}?txHash=${sourceHash}`);
    if (response.status === 429) { limited = true; break; }
    assert.equal(response.status, 200);
  }
  assert.equal(limited, true);
  assert.equal(calls, 56, 'invalid requests count toward the same rate limit and excess requests never reach the upstream');
});
