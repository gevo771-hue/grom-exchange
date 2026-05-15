import test from 'node:test';
import assert from 'node:assert/strict';

import { buildOtpAuthUrl, generateTotp, randomBase32, verifyTotp } from '../src/utils/totp.js';

test('randomBase32 returns uppercase secret-like value', () => {
  const secret = randomBase32(20);
  assert.match(secret, /^[A-Z2-7]+$/);
  assert.ok(secret.length >= 32);
});

test('generateTotp + verifyTotp roundtrip', () => {
  const secret = 'JBSWY3DPEHPK3PXP';
  const now = 1_700_000_000_000;
  const token = generateTotp(secret, { time: now });
  const verified = verifyTotp(secret, token, { time: now });
  assert.equal(verified.ok, true);
  assert.equal(typeof verified.step, 'number');
});

test('buildOtpAuthUrl contains issuer and secret', () => {
  const url = buildOtpAuthUrl({ issuer: 'GROM', accountName: 'user@example.com', secretBase32: 'JBSWY3DPEHPK3PXP' });
  assert.match(url, /^otpauth:\/\/totp\//);
  assert.match(url, /issuer=GROM/);
  assert.match(url, /secret=JBSWY3DPEHPK3PXP/);
});
