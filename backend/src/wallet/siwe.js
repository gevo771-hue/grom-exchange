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
import express from 'express';
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { SiweMessage } from 'siwe';
import { z } from 'zod';
import { query } from '../db/pool.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { buildOtpAuthUrl, randomBase32, verifyTotp } from '../utils/totp.js';
import { ensureWelcomeWalletSeed } from './welcome-seed.js';

const NONCE_TTL_MS = 5 * 60 * 1000;

function emailWalletAddress(email) {
  const hash = createHash('sha256').update(`grom-email:${email}`).digest('hex');
  return `email:${hash.slice(0, 40)}`;
}

async function ensureUserSettingsRow(userId) {
  await query(
    `INSERT INTO user_settings (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

export function createAuthRouter() {
  const r = express.Router();

  if (config.allowDevLogin) {
    r.post('/dev-login', async (req, res, next) => {
      try {
        const demoAddr = '0x000000000000000000000000000000000000d3ad';
        const { rows } = await query(
          `INSERT INTO users (wallet_address, chain_id)
           VALUES ($1, $2)
           ON CONFLICT (wallet_address) DO UPDATE
             SET last_seen_at = NOW(), chain_id = EXCLUDED.chain_id
           RETURNING id, wallet_address, chain_id, kyc_status, risk_level, role`,
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

  const emailLoginSchema = z.object({
    email: z.string().trim().toLowerCase().email().max(160),
  }).strict();

  r.post('/email-login', async (req, res, next) => {
    try {
      const { email } = emailLoginSchema.parse(req.body || {});
      const pseudoWallet = emailWalletAddress(email);
      const { rows } = await query(
        `INSERT INTO users (wallet_address, chain_id)
         VALUES ($1, $2)
         ON CONFLICT (wallet_address) DO UPDATE
           SET last_seen_at = NOW()
         RETURNING id, wallet_address, chain_id, kyc_status, risk_level, role`,
        [pseudoWallet, 0]
      );
      const user = rows[0];
      if (user.risk_level === 'blocked') return res.status(403).json({ error: 'account_blocked' });

      await ensureUserSettingsRow(user.id);
      await ensureWelcomeWalletSeed(user.id);
      await query(
        `UPDATE user_settings
            SET email=$2,
                security=jsonb_set(COALESCE(security,'{}'::jsonb), '{login_email}', 'true'::jsonb, true),
                updated_at=NOW()
          WHERE user_id=$1`,
        [user.id, email]
      );
      await query(
        `INSERT INTO notifications_outbox (user_id, channel, template_key, payload)
         VALUES ($1, 'email', 'login_alert', $2::jsonb)`,
        [user.id, JSON.stringify({ email, method: 'email', at: new Date().toISOString() })]
      ).catch(() => {});

      const token = jwt.sign(
        { sub: user.id, addr: user.wallet_address, chain: user.chain_id, role: user.role || 'user', email },
        config.auth.jwtSecret,
        { expiresIn: config.auth.jwtTtl }
      );
      res.status(201).json({ token, user: { ...user, email }, method: 'email' });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  r.post('/nonce', async (req, res, next) => {
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
  });

  r.post('/verify', async (req, res, next) => {
    try {
      const { message, signature } = verifySchema.parse(req.body);
      const siwe = new SiweMessage(message);
      const result = await siwe.verify({ signature });
      if (!result.success) return res.status(401).json({ error: 'bad signature' });

      const { address, chainId, nonce, issuedAt } = result.data;
      if (config.geoblock.includes(req.headers['cf-ipcountry']?.toUpperCase() || '')) {
        return res.status(403).json({ error: 'geoblocked' });
      }

      // Consume nonce atomically
      const upd = await query(
        `UPDATE siwe_nonces SET consumed_at=NOW()
         WHERE nonce=$1 AND consumed_at IS NULL
           AND issued_at > NOW() - INTERVAL '${Math.floor(NONCE_TTL_MS / 1000)} seconds'
         RETURNING nonce`, [nonce]
      );
      if (upd.rowCount === 0) return res.status(401).json({ error: 'stale nonce' });

      const addr = address.toLowerCase();
      const supported = config.wallet.supportedChains;
      if (supported.length && !supported.includes(Number(chainId))) {
        return res.status(400).json({ error: 'chain not supported', supported });
      }

      // Upsert user
      const { rows } = await query(
        `INSERT INTO users (wallet_address, chain_id)
         VALUES ($1,$2)
         ON CONFLICT (wallet_address) DO UPDATE
           SET last_seen_at = NOW(), chain_id = EXCLUDED.chain_id
         RETURNING id, wallet_address, chain_id, kyc_status, risk_level`,
        [addr, chainId]
      );
      const user = rows[0];
      if (user.risk_level === 'blocked') return res.status(403).json({ error: 'account blocked' });

      await ensureWelcomeWalletSeed(user.id);

      const token = jwt.sign(
        { sub: user.id, addr: user.wallet_address, chain: user.chain_id, role: user.role || 'user' },
        config.auth.jwtSecret,
        { expiresIn: config.auth.jwtTtl }
      );
      res.json({ token, user });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      logger.warn({ err: err.message }, 'siwe verify failed');
      res.status(401).json({ error: 'unauthorized' });
    }
  });

  r.get('/me', requireAuth, async (req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT id, wallet_address, chain_id, kyc_status, risk_level, role FROM users WHERE id=$1`,
        [req.user.sub]
      );
      res.json({ user: rows[0] });
    } catch (err) { next(err); }
  });

  r.post('/2fa/setup', requireAuth, async (req, res, next) => {
    try {
      const secretBase32 = randomBase32(20);
      const accountName = (req.user.addr || 'wallet').toLowerCase();
      const otpauthUrl = buildOtpAuthUrl({
        issuer: 'GROM',
        accountName,
        secretBase32,
      });
      const { rows } = await query(
        `INSERT INTO two_fa_secrets (user_id, secret_base32, enabled, verified_at, disabled_at, last_used_step, updated_at)
         VALUES ($1, $2, FALSE, NULL, NULL, NULL, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET secret_base32=EXCLUDED.secret_base32,
                       enabled=FALSE,
                       verified_at=NULL,
                       disabled_at=NULL,
                       last_used_step=NULL,
                       updated_at=NOW()
         RETURNING user_id, enabled`,
        [req.user.sub, secretBase32]
      );
      await ensureUserSettingsRow(req.user.sub);
      res.status(201).json({
        secret_base32: secretBase32,
        otpauth_url: otpauthUrl,
        enabled: rows[0]?.enabled || false,
      });
    } catch (err) { next(err); }
  });

  r.post('/2fa/verify', requireAuth, async (req, res, next) => {
    try {
      const token = String(req.body?.token || '').trim();
      const { rows } = await query(
        `SELECT secret_base32, enabled, last_used_step
           FROM two_fa_secrets
          WHERE user_id=$1`,
        [req.user.sub]
      );
      const row = rows[0];
      if (!row) return res.status(404).json({ error: 'two_fa_not_setup' });
      const result = verifyTotp(row.secret_base32, token);
      if (!result.ok) return res.status(400).json({ error: 'invalid_totp' });
      if (row.last_used_step != null && Number(row.last_used_step) === Number(result.step)) {
        return res.status(409).json({ error: 'totp_replay' });
      }
      await query(
        `UPDATE two_fa_secrets
            SET enabled=TRUE, verified_at=COALESCE(verified_at, NOW()), disabled_at=NULL, last_used_step=$2, updated_at=NOW()
          WHERE user_id=$1`,
        [req.user.sub, result.step]
      );
      await ensureUserSettingsRow(req.user.sub);
      await query(
        `UPDATE user_settings
            SET security=jsonb_set(COALESCE(security,'{}'::jsonb), '{two_fa}', 'true'::jsonb, true),
                updated_at=NOW()
          WHERE user_id=$1`,
        [req.user.sub]
      );
      res.json({ ok: true, enabled: true });
    } catch (err) { next(err); }
  });

  r.post('/2fa/disable', requireAuth, async (req, res, next) => {
    try {
      const token = String(req.body?.token || '').trim();
      const { rows } = await query(
        `SELECT secret_base32, enabled, last_used_step
           FROM two_fa_secrets
          WHERE user_id=$1`,
        [req.user.sub]
      );
      const row = rows[0];
      if (!row || !row.enabled) return res.status(404).json({ error: 'two_fa_not_enabled' });
      const result = verifyTotp(row.secret_base32, token);
      if (!result.ok) return res.status(400).json({ error: 'invalid_totp' });
      await query(
        `UPDATE two_fa_secrets
            SET enabled=FALSE, disabled_at=NOW(), last_used_step=$2, updated_at=NOW()
          WHERE user_id=$1`,
        [req.user.sub, result.step]
      );
      await ensureUserSettingsRow(req.user.sub);
      await query(
        `UPDATE user_settings
            SET security=jsonb_set(COALESCE(security,'{}'::jsonb), '{two_fa}', 'false'::jsonb, true),
                updated_at=NOW()
          WHERE user_id=$1`,
        [req.user.sub]
      );
      res.json({ ok: true, enabled: false });
    } catch (err) { next(err); }
  });

  return r;
}

export function requireAuth(req, res, next) {
  const hdr = req.headers.authorization || '';
  const m = /^Bearer (.+)$/.exec(hdr);
  if (!m) return res.status(401).json({ error: 'missing token' });
  try {
    req.user = jwt.verify(m[1], config.auth.jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}

export default createAuthRouter;
