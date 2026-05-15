import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  generateSignedUrl,
  parseWebhookEvent,
  verifyWebhook,
} from '../src/onramp/moonpay.js';

const moonpayConfig = {
  publicKey: 'pk_test',
  secretKey: 'secret',
  webhookSecret: 'whsec',
  baseUrl: 'https://buy-sandbox.moonpay.com',
};

test('moonpay signed URL is deterministic for same input', () => {
  const one = generateSignedUrl({
    userId: 'u1',
    walletAddress: '0xabc',
    currency: 'BTC',
    defaultAmount: 100,
    fiatCurrency: 'EUR',
    moonpayConfig,
  });
  const two = generateSignedUrl({
    userId: 'u1',
    walletAddress: '0xabc',
    currency: 'BTC',
    defaultAmount: 100,
    fiatCurrency: 'EUR',
    moonpayConfig,
  });
  assert.equal(one, two);
  assert.match(one, /^https:\/\/buy-sandbox\.moonpay\.com\?/);
  assert.match(one, /signature=/);
});

test('moonpay webhook verifies HMAC signature', () => {
  const body = JSON.stringify({ data: { id: 'mp_1', status: 'completed' } });
  const signature = crypto.createHmac('sha256', 'whsec').update(body).digest('hex');
  assert.equal(verifyWebhook({ headers: { 'moonpay-signature': signature }, body, secret: 'whsec' }), true);
  assert.equal(verifyWebhook({ headers: { 'moonpay-signature': signature }, body: `${body}x`, secret: 'whsec' }), false);
});

test('moonpay webhook parser normalizes completed event', () => {
  const event = parseWebhookEvent({
    data: {
      id: 'mp_1',
      status: 'completed',
      baseCurrency: { code: 'eur' },
      baseCurrencyAmount: 250,
      quoteCurrencyAmount: 0.0025,
      currency: { code: 'btc' },
      walletAddress: 'bc1qtest',
    },
  });
  assert.deepEqual(event, {
    externalOrderId: 'mp_1',
    status: 'completed',
    fiatCurrency: 'EUR',
    fiatAmount: 250,
    cryptoAmount: 0.0025,
    asset: 'BTC',
    walletAddress: 'bc1qtest',
  });
});
