/**
 * User settings persistence: profile, notifications, security, risk, preferences.
 * GET  /api/settings
 * PUT  /api/settings   — partial merge; whitelisted top-level keys only.
 * POST /api/settings/anti-phishing — rotate anti-phishing code.
 */
import express from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { query } from '../db/pool.js';

const settingsSchema = z.object({
  display_name:     z.string().max(120).optional(),
  email:            z.string().email().max(160).optional(),
  language:         z.string().max(8).optional(),
  base_currency:    z.string().max(8).optional(),
  default_leverage: z.number().int().min(1).max(125).optional(),
  notifications:    z.record(z.any()).optional(),
  security:         z.record(z.any()).optional(),
  risk:             z.record(z.any()).optional(),
  preferences:      z.record(z.any()).optional(),
}).strict();

async function ensureRow(userId) {
  await query(
    `INSERT INTO user_settings (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

export function createSettingsRouter({ requireAuth }) {
  const r = express.Router();

  r.get('/', requireAuth, async (req, res, next) => {
    try {
      await ensureRow(req.user.sub);
      const { rows } = await query(
        `SELECT user_id, display_name, email, language, base_currency, default_leverage,
                notifications, security, risk, preferences, updated_at
           FROM user_settings WHERE user_id=$1`,
        [req.user.sub]
      );
      res.json({ settings: rows[0] || null });
    } catch (err) { next(err); }
  });

  r.put('/', requireAuth, async (req, res, next) => {
    try {
      const input = settingsSchema.parse(req.body || {});
      await ensureRow(req.user.sub);
      // Build dynamic SET clause
      const sets = [];
      const params = [req.user.sub];
      let idx = 2;
      for (const key of Object.keys(input)) {
        sets.push(`${key} = $${idx}`);
        params.push(typeof input[key] === 'object' ? JSON.stringify(input[key]) : input[key]);
        idx++;
      }
      sets.push(`updated_at = NOW()`);
      const { rows } = await query(
        `UPDATE user_settings SET ${sets.join(', ')}
           WHERE user_id=$1
         RETURNING user_id, display_name, email, language, base_currency, default_leverage,
                   notifications, security, risk, preferences, updated_at`,
        params
      );
      res.json({ settings: rows[0] });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  r.post('/anti-phishing', requireAuth, async (req, res, next) => {
    try {
      await ensureRow(req.user.sub);
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      await query(
        `UPDATE user_settings
            SET security = COALESCE(security, '{}'::jsonb) || jsonb_build_object('anti_phishing', $2),
                updated_at = NOW()
          WHERE user_id=$1`,
        [req.user.sub, code]
      );
      res.json({ code });
    } catch (err) { next(err); }
  });

  return r;
}

export default createSettingsRouter;
