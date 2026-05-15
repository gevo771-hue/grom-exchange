import crypto from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function randomBase32(bytes = 20) {
  const raw = crypto.randomBytes(bytes);
  let bits = '';
  for (const b of raw) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    out += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return out;
}

export function decodeBase32(base32) {
  const clean = String(base32 || '').toUpperCase().replace(/=+$/g, '').replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function hotp(secretBase32, counter, digits = 6) {
  const key = decodeBase32(secretBase32);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(code % (10 ** digits)).padStart(digits, '0');
}

export function timeStepFor(time = Date.now(), stepSeconds = 30) {
  return Math.floor(Number(time) / 1000 / stepSeconds);
}

export function generateTotp(secretBase32, opts = {}) {
  const step = opts.stepSeconds || 30;
  const digits = opts.digits || 6;
  return hotp(secretBase32, timeStepFor(opts.time || Date.now(), step), digits);
}

export function verifyTotp(secretBase32, token, opts = {}) {
  const step = opts.stepSeconds || 30;
  const digits = opts.digits || 6;
  const window = opts.window ?? 1;
  const tokenStr = String(token || '').trim();
  if (!/^\d{6,8}$/.test(tokenStr)) return { ok: false, step: null };
  const center = timeStepFor(opts.time || Date.now(), step);
  for (let offset = -window; offset <= window; offset += 1) {
    const ctr = center + offset;
    if (ctr < 0) continue;
    if (hotp(secretBase32, ctr, digits) === tokenStr) return { ok: true, step: ctr };
  }
  return { ok: false, step: null };
}

export function buildOtpAuthUrl({ issuer, accountName, secretBase32 }) {
  const label = `${issuer}:${accountName}`;
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}
