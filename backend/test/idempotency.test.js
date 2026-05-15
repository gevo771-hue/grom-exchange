import test from 'node:test';
import assert from 'node:assert/strict';

import { requestFingerprint, stableStringify } from '../src/middleware/idempotency.js';

test('stableStringify makes object key order deterministic', () => {
  assert.equal(stableStringify({ b: 2, a: 1 }), stableStringify({ a: 1, b: 2 }));
  assert.equal(stableStringify({ z: [{ b: 2, a: 1 }] }), '{"z":[{"a":1,"b":2}]}');
});

test('requestFingerprint changes with method, url, or body', () => {
  const req = { method: 'POST', originalUrl: '/api/spot/orders', body: { pair: 'BTC/USDT', amount: 1 } };
  const same = { method: 'POST', originalUrl: '/api/spot/orders', body: { amount: 1, pair: 'BTC/USDT' } };
  const differentBody = { method: 'POST', originalUrl: '/api/spot/orders', body: { amount: 2, pair: 'BTC/USDT' } };
  const differentUrl = { method: 'POST', originalUrl: '/api/futures/orders', body: { amount: 1, pair: 'BTC/USDT' } };

  assert.equal(requestFingerprint(req), requestFingerprint(same));
  assert.notEqual(requestFingerprint(req), requestFingerprint(differentBody));
  assert.notEqual(requestFingerprint(req), requestFingerprint(differentUrl));
});
