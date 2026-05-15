import crypto from 'node:crypto';
import config from '../config/index.js';

function hmacHex(secret, data) {
  return crypto.createHmac('sha256', secret || '').update(data).digest('hex');
}

function safeEqualHex(a, b) {
  const left = String(a || '').replace(/^sha256=/i, '');
  const right = String(b || '').replace(/^sha256=/i, '');
  if (!left || !right || left.length !== right.length) return false;
  return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export function generateSumsubSignature({ secret, ts, method, path, body = '' }) {
  return hmacHex(secret, `${ts}${method.toUpperCase()}${path}${body}`);
}

export function verifyWebhook({ headers = {}, body = '', secret = config.kyc.sumsub.webhookSecret } = {}) {
  const provided = headers['x-payload-digest'] || headers['X-Payload-Digest'] || headers['x-sumsub-signature'];
  if (!secret || !provided) return false;
  return safeEqualHex(hmacHex(secret, body || ''), provided);
}

export function mapSumsubKycStatus(payload = {}) {
  const answer = payload.reviewResult?.reviewAnswer || payload.reviewAnswer || payload.review?.reviewAnswer;
  const status = payload.reviewStatus || payload.review_status || payload.status;
  if (answer === 'GREEN') return 'verified';
  if (answer === 'RED') return 'rejected';
  if (answer === 'RETRY') return 'pending';
  if (['init', 'pending', 'queued', 'onHold'].includes(status)) return 'pending';
  return 'pending';
}

export function extractExternalUserId(payload = {}) {
  return payload.externalUserId || payload.external_user_id || payload.externalUserID || payload.applicantId || payload.applicant?.externalUserId || '';
}

export class SumsubClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey ?? config.kyc.sumsub.apiKey;
    this.apiSecret = options.apiSecret ?? config.kyc.sumsub.apiSecret;
    this.baseUrl = (options.baseUrl ?? config.kyc.sumsub.baseUrl).replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
  }

  async signedRequest(method, path, bodyObj = null) {
    if (!this.apiKey || !this.apiSecret) throw new Error('sumsub_credentials_missing');
    const body = bodyObj ? JSON.stringify(bodyObj) : '';
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = generateSumsubSignature({ secret: this.apiSecret, ts, method, path, body });
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-App-Token': this.apiKey,
        'X-App-Access-Ts': ts,
        'X-App-Access-Sig': sig,
      },
      body: body || undefined,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const err = new Error(`sumsub_http_${res.status}`);
      err.payload = data;
      throw err;
    }
    return data;
  }

  async generateAccessToken({ userId, levelName = config.kyc.sumsub.levelName }) {
    const externalUserId = `grom-${userId}`;
    const path = `/resources/accessTokens?userId=${encodeURIComponent(externalUserId)}&levelName=${encodeURIComponent(levelName)}&ttlInSecs=600`;
    const data = await this.signedRequest('POST', path);
    return { sdkToken: data.token, levelName, externalUserId, raw: data };
  }

  async getApplicantStatus(externalUserId) {
    const path = `/resources/applicants/-;externalUserId=${encodeURIComponent(externalUserId)}/one`;
    return this.signedRequest('GET', path);
  }
}

export default SumsubClient;
