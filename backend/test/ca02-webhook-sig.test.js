import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyWebhookSignature, captureRawBody } from '../src/utils/webhook-sig.js';

describe('CA-02 webhook signature', () => {
  const secret = 'test-webhook-secret';

  it('accepts HMAC over exact raw bytes', () => {
    const raw = Buffer.from('{"ok":true,"n":1}');
    const sig = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    assert.equal(verifyWebhookSignature(secret, raw, sig), true);
  });

  it('rejects when whitespace differs from signed raw body', () => {
    const raw = Buffer.from('{"ok":true}');
    const sig = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    const reparsed = Buffer.from(JSON.stringify(JSON.parse(raw.toString())));
    /* same semantic JSON may differ — signature must use original bytes */
    assert.equal(verifyWebhookSignature(secret, reparsed, sig), reparsed.equals(raw));
    assert.equal(verifyWebhookSignature(secret, Buffer.from('{"ok": true}'), sig), false);
  });

  it('rejects one-byte flip and missing secret', () => {
    const raw = Buffer.from('{"a":1}');
    const sig = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    const flipped = Buffer.from(raw);
    flipped[2] = flipped[2] ^ 1;
    assert.equal(verifyWebhookSignature(secret, flipped, sig), false);
    const badSig = (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1);
    assert.equal(verifyWebhookSignature(secret, raw, badSig), false);
    assert.equal(verifyWebhookSignature('', raw, sig), false);
  });

  it('captureRawBody stores a Buffer copy on req', () => {
    const req = {};
    const buf = Buffer.from('abc');
    captureRawBody(req, null, buf);
    assert.ok(Buffer.isBuffer(req.rawBody));
    assert.equal(req.rawBody.toString(), 'abc');
    buf.write('xxx');
    assert.equal(req.rawBody.toString(), 'abc');
  });
});
