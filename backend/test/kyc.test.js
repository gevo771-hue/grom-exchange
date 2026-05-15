import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  generateSumsubSignature,
  mapSumsubKycStatus,
  verifyWebhook,
  SumsubClient,
} from '../src/kyc/sumsub.js';

test('sumsub API signature uses timestamp, method, path and body', () => {
  const sig = generateSumsubSignature({
    secret: 's',
    ts: '1700000000',
    method: 'POST',
    path: '/resources/accessTokens',
    body: '{"a":1}',
  });
  const expected = crypto.createHmac('sha256', 's').update('1700000000POST/resources/accessTokens{"a":1}').digest('hex');
  assert.equal(sig, expected);
});

test('sumsub webhook verifies valid HMAC and rejects tampered body', () => {
  const body = JSON.stringify({ reviewResult: { reviewAnswer: 'GREEN' } });
  const signature = crypto.createHmac('sha256', 'webhook-secret').update(body).digest('hex');
  assert.equal(verifyWebhook({ headers: { 'x-payload-digest': signature }, body, secret: 'webhook-secret' }), true);
  assert.equal(verifyWebhook({ headers: { 'x-payload-digest': signature }, body: `${body}x`, secret: 'webhook-secret' }), false);
});

test('sumsub status mapping supports approved, rejected and retry states', () => {
  assert.equal(mapSumsubKycStatus({ reviewResult: { reviewAnswer: 'GREEN' } }), 'verified');
  assert.equal(mapSumsubKycStatus({ reviewResult: { reviewAnswer: 'RED' } }), 'rejected');
  assert.equal(mapSumsubKycStatus({ reviewResult: { reviewAnswer: 'RETRY' } }), 'pending');
  assert.equal(mapSumsubKycStatus({ reviewStatus: 'pending' }), 'pending');
});

test('sumsub generateAccessToken returns normalized SDK token shape', async () => {
  const fetchImpl = async (_url, req) => {
    assert.equal(req.method, 'POST');
    assert.equal(Boolean(req.headers['X-App-Access-Sig']), true);
    return { ok: true, text: async () => JSON.stringify({ token: 'sdk-token' }) };
  };
  const client = new SumsubClient({
    apiKey: 'key',
    apiSecret: 'secret',
    baseUrl: 'https://test-api.sumsub.com',
    fetchImpl,
  });
  const result = await client.generateAccessToken({ userId: '00000000-0000-4000-8000-000000000001', levelName: 'basic' });
  assert.equal(result.sdkToken, 'sdk-token');
  assert.equal(result.levelName, 'basic');
  assert.equal(result.externalUserId, 'grom-00000000-0000-4000-8000-000000000001');
});
