/**
 * API key CRUD with hashed secrets.
 *   GET    /api/apikeys
 *   POST   /api/apikeys
 *   DELETE /api/apikeys/:id
 *
 * Secrets are hashed with sha256(prefix + secret + JWT_SECRET).
 * On creation we return the secret ONCE to the caller; it is never persisted plain.
 */
import express from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import config from '../config/index.js';
import { query } from '../db/pool.js';

const createSchema = z.object({
  label:        z.string().min(2).max(120),
  permissions:  z.array(z.enum(['read', 'trade', 'withdraw'])).min(1).default(['read']),
  ip_whitelist: z.array(z.string().min(7).max(45)).max(20).optional(),
}).strict();

function makeKey() {
  const prefix  = 'grom_' + crypto.randomBytes(3).toString('hex');
  const secret  = crypto.randomBytes(24).toString('hex');
  return { prefix, secret };
}
function hash(prefix, secret) {
  return crypto
    .createHash('sha256')
    .update(prefix + ':' + secret + ':' + (config.auth.jwtSecret || ''))
    .digest('hex');
}

export function createApiKeysRouter({ requireAuth }) {
  const r = express.Router();

  r.get('/', requireAuth, async (req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT id, label, key_prefix, permissions, ip_whitelist, status,
                last_used_at, created_at, revoked_at
           FROM api_keys
           WHERE user_id=$1
           ORDER BY created_at DESC`,
        [req.user.sub]
      );
      res.json({ keys: rows });
    } catch (err) { next(err); }
  });

  r.post('/', requireAuth, async (req, res, next) => {
    try {
      const input = createSchema.parse(req.body || {});
      const { prefix, secret } = makeKey();
      const keyHash = hash(prefix, secret);
      const { rows } = await query(
        `INSERT INTO api_keys (user_id, label, key_prefix, key_hash, permissions, ip_whitelist)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)
        RETURNING id, label, key_prefix, permissions, ip_whitelist, status, created_at`,
        [req.user.sub, input.label, prefix, keyHash, JSON.stringify(input.permissions), input.ip_whitelist || null]
      );
      res.status(201).json({
        key: rows[0],
        // ONLY returned at creation time
        secret_once: secret,
        warning: 'Copy and store the secret now — it cannot be retrieved later.',
      });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  r.delete('/:id', requireAuth, async (req, res, next) => {
    try {
      const { rows } = await query(
        `UPDATE api_keys
            SET status='revoked', revoked_at=NOW()
          WHERE id=$1 AND user_id=$2 AND status='active'
        RETURNING id`,
        [req.params.id, req.user.sub]
      );
      if (!rows.length) return res.status(404).json({ error: 'not_found' });
      res.json({ ok: true, revoked_id: rows[0].id });
    } catch (err) { next(err); }
  });

  return r;
}

export default createApiKeysRouter;
