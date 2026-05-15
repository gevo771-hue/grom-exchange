import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createConsoleNotificationProvider,
  nextNotificationDelaySeconds,
} from '../src/notifications/worker.js';
import { interpolate } from '../src/notifications/template-renderer.js';
import { parseFrom, sendEmail } from '../src/notifications/sendgrid.js';

test('notification retry backoff caps at the last configured window', () => {
  assert.equal(nextNotificationDelaySeconds(1), 5);
  assert.equal(nextNotificationDelaySeconds(2), 30);
  assert.equal(nextNotificationDelaySeconds(3), 300);
  assert.equal(nextNotificationDelaySeconds(99), 3600);
});

test('console notification provider exposes email and sms senders', () => {
  const provider = createConsoleNotificationProvider();
  assert.equal(typeof provider.email, 'function');
  assert.equal(typeof provider.sms, 'function');
});

test('template interpolation supports nested and fallback payload keys', () => {
  const result = interpolate('Code ${otp.code}, amount ${transfer.amount}, asset ${asset}', {
    otp: { code: '123456' },
    transfer: { amount: '10' },
    asset: 'USDT',
  });
  assert.equal(result, 'Code 123456, amount 10, asset USDT');
});

test('sendgrid sendEmail returns ok on provider 202', async () => {
  const fetchImpl = async () => ({
    status: 202,
    headers: { get: (key) => key === 'x-message-id' ? 'msg-1' : null },
  });
  const result = await sendEmail(
    { to: 'user@example.com', subject: 'S', html: '<p>H</p>', text: 'T' },
    { apiKey: 'k', dryRun: false, fetchImpl }
  );
  assert.deepEqual(result, { ok: true, messageId: 'msg-1' });
});

test('sendgrid sendEmail retries 5xx and fails after attempts', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { status: 503, headers: { get: () => null } };
  };
  const result = await sendEmail(
    { to: 'user@example.com', subject: 'S', html: '<p>H</p>', text: 'T' },
    { apiKey: 'k', dryRun: false, fetchImpl, retries: 3, timeoutMs: 1000 }
  );
  assert.equal(calls, 3);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'sendgrid_http_503');
});

test('parseFrom handles display-name sender', () => {
  assert.deepEqual(parseFrom('GROM <noreply@grom.exchange>'), {
    name: 'GROM',
    email: 'noreply@grom.exchange',
  });
});
