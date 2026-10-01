import test from 'node:test';
import assert from 'node:assert/strict';
import { isCurrentPmEnd } from '../src/market/predict-freshness.js';

test('prediction events stop being current as soon as their end time passes', () => {
  const now = Date.parse('2026-10-01T00:00:00.000Z');
  assert.equal(isCurrentPmEnd('2026-09-30T23:59:59.999Z', now), false);
  assert.equal(isCurrentPmEnd('2026-10-01T00:00:00.000Z', now), false);
  assert.equal(isCurrentPmEnd('2026-10-01T00:00:00.001Z', now), true);
});

test('missing event expiry remains allowed, but malformed expiry fails closed', () => {
  assert.equal(isCurrentPmEnd(undefined, 0), true);
  assert.equal(isCurrentPmEnd('', 0), true);
  assert.equal(isCurrentPmEnd('not-a-date', 0), false);
});
