/**
 * Sign-In with Ethereum (EIP-4361) auth.
 *
 * Flow:
 *   1. POST /auth/nonce         → server issues a single-use nonce + statement
 *   2. Frontend asks wallet to sign the SIWE message
 *   3. POST /auth/verify        → server verifies signature, consumes nonce, issues JWT
 *
 * JWT payload: { sub: userId, addr, chain, iat, exp }
 * JWT lifetime: config.auth.jwtTtl (seconds)
 */
import { getAddress } from 'ethers';
import express from 'express';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { SiweMessage } from 'siwe';
import { z } from 'zod';
import { query } from '../db/pool.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { attachReferralCode, ensureReferralCode } from '../referral/invite.js';
import { logUserActivity } from '../activity/log.js';

const NONCE_TTL_MS = 5 * 60 * 1000;

/** SIWE requires EIP-55 checksum in the message body. */
function siweFmtAddress(raw) {
  return getAddress(String(raw).toLowerCase());
}

function buildSiweMessage({ address, domain, statement, uri, chainId, nonce, issuedAt }) {
  const dom = String(domain || 'grom.exchange').replace(/^https?:\/\//, '').replace(/^www\./i, '');
  const addr = siweFmtAddress(address);
  const stmt = statement || 'Sign in to GROM Exchange';
  const u = uri || `https://${dom}`;
  const iat = issuedAt || new Date().toISOString();
  return `${dom} wants you to sign in with your Ethereum account:
${addr}

${stmt}

URI: ${u}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${iat}`;
}

async function ensureUserSettingsRow(userId) {
  await query(
    `INSERT INTO user_settings (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

/** Shared SIWE verify → JWT. Returns { token, user } or { error, status, extra }. */
async function completeSiweLogin({ message, signature, referralCode, req, method }) {
  let result;
  try {
    const siwe = new SiweMessage(message);
    const domain = config.wallet.siweDomain;
    result = await siwe.verify({
      signature,
      domain,
      nonce: siwe.nonce,
    });
    if (domain && siwe.domain && String(siwe.domain).toLowerCase() !== String(domain).toLowerCase()) {
      return { error: 'siwe_domain_mismatch', status: 401 };
    }
    const allowedOrigins = [
      `https://${domain}`,
      `http://${domain}`,
      ...(config.cors?.origin ? [String(config.cors.origin)] : []),
    ].map((u) => u.replace(/\/$/, '').toLowerCase());
    if (siwe.uri) {
      try {
        const uriHost = new URL(siwe.uri).host.toLowerCase();
        const okUri = allowedOrigins.some((o) => {
          try { return new URL(o).host.toLowerCase() === uriHost; } catch { return false; }
        }) || uriHost === String(domain).toLowerCase();
        if (!okUri) return { error: 'siwe_uri_mismatch', status: 401 };
      } catch {
        return { error: 'siwe_uri_mismatch', status: 401 };
      }
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'siwe verify failed');
    return { error: err.message || 'bad signature', status: 401 };
  }
  if (!result.success) return { error: 'bad signature', status: 401 };

  const { address, chainId, nonce } = result.data;
  if (config.geoblock.includes(req?.headers?.['cf-ipcountry']?.toUpperCase() || '')) {
    return { error: 'geoblocked', status: 403 };
  }

  const upd = await query(
    `UPDATE siwe_nonces SET consumed_at=NOW()
     WHERE nonce=$1 AND consumed_at IS NULL
       AND issued_at > NOW() - INTERVAL '${Math.floor(NONCE_TTL_MS / 1000)} seconds'
     RETURNING nonce`, [nonce]
  );
  if (upd.rowCount === 0) return { error: 'stale nonce', status: 401 };

  const addr = address.toLowerCase();
  const supported = config.wallet.supportedChains;
  if (supported.length && !supported.includes(Number(chainId))) {
    return { error: 'chain not supported', status: 400, extra: { supported } };
  }

  const inserted = await query(
    `INSERT INTO users (wallet_address, chain_id)
     VALUES ($1,$2)
     ON CONFLICT (wallet_address) DO NOTHING
     RETURNING id, wallet_address, chain_id, risk_level, role`,
    [addr, chainId]
  );
  const isNew = inserted.rowCount === 1;
  const resultUser = isNew ? inserted.rows[0] : (await query(
    `UPDATE users SET last_seen_at=NOW(), chain_id=$2
      WHERE wallet_address=$1
      RETURNING id, wallet_address, chain_id, risk_level, role`,
    [addr, chainId]
  )).rows[0];
  const user = resultUser;
  if (!user) return { error: 'account unavailable', status: 401 };
  if (user.risk_level === 'blocked') return { error: 'account blocked', status: 403 };

  await ensureUserSettingsRow(user.id);
  try {
    await ensureReferralCode(user.id);
    if (isNew && referralCode) await attachReferralCode(user.id, referralCode);
  } catch (err) {
    // Referral tracking must never block wallet authentication.
    logger.warn({ err: err.message, userId: user.id }, 'referral attribution failed');
  }

  await logUserActivity({
    userId: user.id,
    wallet: addr,
    product: 'auth',
    action: isNew ? 'register' : 'login',
    detail: { chain_id: Number(chainId), method: method || 'siwe' },
    status: 'done',
  });

  const token = jwt.sign(
    { sub: user.id, addr: user.wallet_address, chain: user.chain_id, role: user.role || 'user' },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtTtl }
  );
  return { token, user };
}

export function createAuthRouter() {
  const r = express.Router();

  /* Rate limiters for /auth/* — protect against credential stuffing and
   * nonce-spam DoS. Tight on login (10/min/IP), generous on
   * nonce since SIWE wallets re-issue on every connect attempt. */
  // Behind nginx/Cloudflare trust proxy is true — disable express-rate-limit's
  // permissive-trust-proxy ValidationError (ERR_ERL_PERMISSIVE_TRUST_PROXY),
  // which otherwise throws on /auth/* and breaks wallet SIWE login.
  const rlOpts = {
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    message: { error: 'too_many_requests', retryAfterSec: 60 },
  };
  const nonceLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, ...rlOpts });
  const verifyLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, ...rlOpts });

  if (config.allowDevLogin) {
    r.post('/dev-login', async (req, res, next) => {
      try {
        const demoAddr = '0x000000000000000000000000000000000000d3ad';
        const { rows } = await query(
          `INSERT INTO users (wallet_address, chain_id)
           VALUES ($1, $2)
           ON CONFLICT (wallet_address) DO UPDATE
             SET last_seen_at = NOW(), chain_id = EXCLUDED.chain_id
           RETURNING id, wallet_address, chain_id, risk_level, role`,
          [demoAddr, 1]
        );
        const user = rows[0];
        const token = jwt.sign(
          { sub: user.id, addr: user.wallet_address, chain: user.chain_id, role: user.role || 'user' },
          config.auth.jwtSecret,
          { expiresIn: config.auth.jwtTtl }
        );
        res.json({ token, user, dev: true });
      } catch (err) { next(err); }
    });
  }

  r.post('/nonce', nonceLimiter, async (req, res, next) => {
    try {
      const nonce = randomBytes(16).toString('hex');
      await query(`INSERT INTO siwe_nonces (nonce) VALUES ($1)`, [nonce]);
      res.json({
        nonce,
        statement: config.wallet.siweStatement,
        domain: config.wallet.siweDomain,
        version: '1',
      });
    } catch (err) { next(err); }
  });

  const verifySchema = z.object({
    message:   z.string().min(20),
    signature: z.string().min(20),
    referralCode: z.string().trim().max(16).optional(),
  });

  r.post('/verify', verifyLimiter, async (req, res, next) => {
    try {
      const { message, signature, referralCode } = verifySchema.parse(req.body);
      const out = await completeSiweLogin({ message, signature, referralCode, req });
      if (out.error) return res.status(out.status).json({ error: out.error, ...(out.extra || {}) });
      res.json({ token: out.token, user: out.user });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      logger.warn({ err: err.message }, 'siwe verify failed');
      res.status(401).json({ error: 'unauthorized' });
    }
  });

  /* ----- Device login (desktop QR → Trust DApp Browser signs → desktop polls) ----- */
  const deviceStartSchema = z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    chainId: z.number().int().positive().optional(),
  }).strict();

  r.post('/device/start', nonceLimiter, async (req, res, next) => {
    try {
      const { address, chainId: bodyChain } = deviceStartSchema.parse(req.body || {});
      const addr = address.toLowerCase();
      const chainId = Number(bodyChain) || 1;
      const supported = config.wallet.supportedChains;
      if (supported.length && !supported.includes(chainId)) {
        return res.status(400).json({ error: 'chain not supported', supported });
      }

      await query(`DELETE FROM device_logins WHERE expires_at < NOW() OR (wallet_address=$1 AND status='pending')`, [addr]);

      const nonce = randomBytes(16).toString('hex');
      await query(`INSERT INTO siwe_nonces (nonce) VALUES ($1)`, [nonce]);

      const domain = config.wallet.siweDomain || 'grom.exchange';
      const statement = config.wallet.siweStatement || 'Sign in to GROM Exchange';
      const uri = `https://${String(domain).replace(/^https?:\/\//, '')}`;
      const message = buildSiweMessage({
        address: addr,
        domain,
        statement,
        uri,
        chainId,
        nonce,
      });

      const code = randomBytes(4).toString('hex'); // 8 hex chars
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      await query(
        `INSERT INTO device_logins (code, wallet_address, message, nonce, chain_id, status, expires_at)
         VALUES ($1,$2,$3,$4,$5,'pending',$6)`,
        [code, addr, message, nonce, chainId, expiresAt.toISOString()]
      );

      const signUrl = `${uri}/?grom_device=${code}`;
      res.json({
        code,
        message,
        chainId,
        address: addr,
        expiresAt: expiresAt.toISOString(),
        signUrl,
        trustUrl: `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(signUrl)}`,
      });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  r.get('/device/:code', async (req, res, next) => {
    try {
      const code = String(req.params.code || '').toLowerCase();
      if (!/^[a-f0-9]{8}$/.test(code)) return res.status(400).json({ error: 'bad_code' });
      const { rows } = await query(
        `SELECT code, wallet_address, message, chain_id, status, expires_at, token, user_json
           FROM device_logins WHERE code=$1 LIMIT 1`,
        [code]
      );
      const row = rows[0];
      if (!row) return res.status(404).json({ error: 'not_found' });
      if (new Date(row.expires_at).getTime() < Date.now() && row.status === 'pending') {
        return res.status(410).json({ error: 'expired' });
      }
      if (row.status === 'done' && row.token) {
        return res.json({ status: 'done', token: row.token, user: row.user_json });
      }
      res.json({
        status: 'pending',
        address: row.wallet_address,
        message: row.message,
        chainId: row.chain_id,
        expiresAt: row.expires_at,
      });
    } catch (err) { next(err); }
  });

  const deviceCompleteSchema = z.object({
    code: z.string().regex(/^[a-fA-F0-9]{8}$/),
    signature: z.string().min(20),
    referralCode: z.string().trim().max(16).optional(),
  }).strict();

  r.post('/device/complete', verifyLimiter, async (req, res, next) => {
    try {
      const { code, signature, referralCode } = deviceCompleteSchema.parse(req.body || {});
      const codeNorm = code.toLowerCase();
      const { rows } = await query(
        `SELECT code, wallet_address, message, status, expires_at
           FROM device_logins WHERE code=$1 LIMIT 1`,
        [codeNorm]
      );
      const row = rows[0];
      if (!row) return res.status(404).json({ error: 'not_found' });
      if (row.status === 'done') return res.json({ ok: true, status: 'done' });
      if (new Date(row.expires_at).getTime() < Date.now()) {
        return res.status(410).json({ error: 'expired' });
      }

      const out = await completeSiweLogin({
        message: row.message,
        signature,
        referralCode,
        req,
        method: 'device_siwe',
      });
      if (out.error) return res.status(out.status).json({ error: out.error, ...(out.extra || {}) });

      await query(
        `UPDATE device_logins
            SET status='done', token=$2, user_json=$3::jsonb, completed_at=NOW()
          WHERE code=$1`,
        [codeNorm, out.token, JSON.stringify(out.user)]
      );
      res.json({ ok: true, status: 'done', token: out.token, user: out.user });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      logger.warn({ err: err.message }, 'device siwe complete failed');
      res.status(401).json({ error: 'unauthorized' });
    }
  });

  r.get('/me', requireAuth, async (req, res, next) => {
    try {
      await query(`UPDATE users SET last_seen_at = NOW() WHERE id = $1`, [req.user.sub]).catch(() => {});
      const { rows } = await query(
        `SELECT id, wallet_address, chain_id, risk_level, role FROM users WHERE id=$1`,
        [req.user.sub]
      );
      res.json({ user: rows[0] });
    } catch (err) { next(err); }
  });

  /** Lightweight heartbeat — keeps admin "online now" accurate while tab is open. */
  r.post('/presence', requireAuth, async (req, res, next) => {
    try {
      await query(`UPDATE users SET last_seen_at = NOW() WHERE id = $1`, [req.user.sub]);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  return r;
}

export async function requireAuth(req, res, next) {
  const hdr = req.headers.authorization || '';
  const m = /^Bearer (.+)$/.exec(hdr);
  if (!m) return res.status(401).json({ error: 'missing token' });
  try {
    req.user = jwt.verify(m[1], config.auth.jwtSecret);
    const { rows } = await query(
      `SELECT u.status, u.risk_level, u.role,
              (SELECT security->>'forced_logout_at' FROM user_settings WHERE user_id=u.id) AS forced_logout_at
         FROM users u WHERE u.id=$1 LIMIT 1`,
      [req.user.sub]
    );
    const row = rows[0];
    if (!row) return res.status(401).json({ error: 'invalid token' });
    if (row.status === 'suspended' || row.risk_level === 'blocked') {
      return res.status(403).json({ error: 'account_suspended' });
    }
    if (row.forced_logout_at && req.user.iat) {
      const forcedAt = new Date(row.forced_logout_at).getTime() / 1000;
      if (req.user.iat < forcedAt) {
        return res.status(401).json({ error: 'session_revoked' });
      }
    }
    req.user.role = row.role || req.user.role || 'user';
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}

export default createAuthRouter;
