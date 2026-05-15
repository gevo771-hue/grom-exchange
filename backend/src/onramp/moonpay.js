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

export function generateSignedUrl({
  userId,
  walletAddress,
  currency,
  defaultAmount = 100,
  fiatCurrency = 'EUR',
  moonpayConfig = config.onramp.moonpay,
} = {}) {
  const params = new URLSearchParams({
    apiKey: moonpayConfig.publicKey || '',
    currencyCode: String(currency || 'USDT').toLowerCase(),
    walletAddress: walletAddress || '',
    baseCurrencyCode: String(fiatCurrency || 'EUR').toLowerCase(),
    baseCurrencyAmount: String(defaultAmount || 100),
    externalCustomerId: String(userId || ''),
  });
  params.sort();
  const query = params.toString();
  const signature = hmacHex(moonpayConfig.secretKey || '', query);
  return `${moonpayConfig.baseUrl}?${query}&signature=${encodeURIComponent(signature)}`;
}

export function verifyWebhook({ headers = {}, body = '', secret = config.onramp.moonpay.webhookSecret } = {}) {
  const provided = headers['moonpay-signature'] || headers['x-moonpay-signature'] || headers['Moonpay-Signature'];
  if (!secret || !provided) return false;
  return safeEqualHex(hmacHex(secret, body || ''), provided);
}

export function parseWebhookEvent(payload = {}) {
  const data = payload.data || payload;
  const statusRaw = String(data.status || payload.type || '').toLowerCase();
  const status = statusRaw.includes('complete') ? 'completed'
    : statusRaw.includes('fail') ? 'failed'
      : statusRaw.includes('refund') ? 'refunded'
        : 'pending';
  return {
    externalOrderId: String(data.id || data.transactionId || data.externalOrderId || ''),
    status,
    fiatCurrency: String(data.baseCurrency?.code || data.fiatCurrency || data.baseCurrencyCode || 'EUR').toUpperCase(),
    fiatAmount: Number(data.baseCurrencyAmount || data.fiatAmount || data.fiat_amount || 0),
    cryptoAmount: Number(data.quoteCurrencyAmount || data.cryptoAmount || data.crypto_amount || 0),
    asset: String(data.currency?.code || data.currencyCode || data.asset || 'USDT').toUpperCase(),
    walletAddress: data.walletAddress || data.wallet_address || '',
  };
}

export default { generateSignedUrl, verifyWebhook, parseWebhookEvent };
