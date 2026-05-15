import test from 'node:test';
import assert from 'node:assert/strict';

import {
  captureException,
  sentryErrorMiddleware,
  sentryRequestMiddleware,
} from '../src/utils/sentry.js';

test('sentry helpers are safe when DSN is not configured', () => {
  assert.doesNotThrow(() => captureException(new Error('test'), { user: { sub: 'u1' } }));
});

test('sentry request middleware passes through and accepts authenticated user context', async () => {
  const mw = sentryRequestMiddleware();
  await new Promise((resolve) => mw({ method: 'GET', path: '/x', user: { sub: 'u1', addr: '0xabc' } }, {}, resolve));
});

test('sentry error middleware forwards errors to the next handler', async () => {
  const err = new Error('boom');
  const mw = sentryErrorMiddleware();
  await new Promise((resolve) => mw(err, { method: 'GET', path: '/x', ip: '127.0.0.1', user: { sub: 'u1' } }, {}, (nextErr) => {
    assert.equal(nextErr, err);
    resolve();
  }));
});
