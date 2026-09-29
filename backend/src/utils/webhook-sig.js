import crypto from 'node:crypto';

/**
 * HMAC-SHA256 hex digest over raw webhook body bytes.
 * Constant-time compare against the provided signature (hex).
 */
export function verifyWebhookSignature(secret, rawBody, provided) {
  if (!secret) return false;
  const body = Buffer.isBuffer(rawBody)
    ? rawBody
    : Buffer.from(rawBody == null ? '' : String(rawBody));
  if (!body.length && rawBody !== '' && !Buffer.isBuffer(rawBody) && rawBody != null) {
    /* empty Buffer is valid only if caller intentionally signed empty — still hash it */
  }
  const expectedHex = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const got = String(provided || '').trim().toLowerCase();
  const exp = expectedHex.toLowerCase();
  if (!got || got.length !== exp.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(got, 'utf8'), Buffer.from(exp, 'utf8'));
  } catch {
    return false;
  }
}

/** Express json verify hook — capture exact bytes for HMAC. */
export function captureRawBody(req, _res, buf) {
  if (Buffer.isBuffer(buf)) req.rawBody = Buffer.from(buf);
}
