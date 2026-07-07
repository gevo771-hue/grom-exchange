/**
 * Referral commission ledger.
 *   GET  /api/referral/summary     — totals + recent commissions + funnel stats
 *   GET  /api/referral/commissions — paginated ledger (export-ready)
 *   POST /api/referral/payout      — set / update payout wallet, schedule, asset
 *   POST /api/referral/claim       — mark pending commissions as queued for payout
 */
import express from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import config from '../config/index.js';
import { inviteCode } from './invite.js';

// Deterministic short invite code from user id — same input always yields same
// 6-char base32-style code, e.g. GROM-K8R2QX. No DB schema change required.
function inviteCodeFromUser(userId) {
  return inviteCode(userId);
}

function inviteLink(req, code) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'grom.exchange';
  return `${proto}://${host}/r/${code.replace(/^GROM-/, '')}`;
}

const payoutSchema = z.object({
  payout_wallet: z.string().min(8).max(120).optional(),
  payout_chain:  z.string().min(2).max(24).optional(),
  schedule:      z.enum(['daily', 'weekly', 'manual']).optional(),
  min_payout:    z.number().min(1).max(100000).optional(),
  asset:         z.enum(['USDT', 'USDC', 'BTC', 'ETH']).optional(),
}).strict();

async function ensureSeed(userId) {
  if (config.env === 'production') return;
  // Both inserts depend on a FK to users(id). If the caller authenticated via
  // an external IdP (Privy / SIWE wallet) and there's no row in users yet,
  // these INSERTs will violate FK and throw. We swallow errors here so the
  // summary endpoint still answers with code/link/totals — seed is optional.
  try {
    await query(
      `INSERT INTO referral_payout_settings (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
  } catch (e) {
    console.warn('[referral] ensureSeed payout_settings insert skipped:', e.code || e.message);
    return;
  }
  // Dev-friendly seed of recent commissions if none exist
  let c;
  try {
    c = await query('SELECT 1 FROM referral_commissions WHERE affiliate_id=$1 LIMIT 1', [userId]);
  } catch (e) {
    console.warn('[referral] ensureSeed commissions check skipped:', e.code || e.message);
    return;
  }
  if (c.rowCount === 0) {
    const samples = [
      { type: 'commission', ref: 'spot-fee-share',   amount: 182.44, status: 'pending', days: 0 },
      { type: 'bonus',      ref: 'new-signup-T2',    amount: 25.00,  status: 'settled', days: 1 },
      { type: 'commission', ref: 'spot-fee-share',   amount: 118.66, status: 'settled', days: 2 },
      { type: 'commission', ref: 'futures-fee-share',amount: 462.10, status: 'settled', days: 3 },
      { type: 'commission', ref: 'binary-payout',    amount: 93.20,  status: 'settled', days: 4 },
    ];
    for (const s of samples) {
      try {
        await query(
          `INSERT INTO referral_commissions
             (affiliate_id, source_type, source_ref, amount_usdt, status, created_at, settled_at)
           VALUES
             ($1, $2, $3, $4, $5, NOW() - ($6 || ' days')::interval,
              CASE WHEN $5='settled' THEN NOW() - ($6 || ' days')::interval ELSE NULL END)`,
          [userId, s.type, s.ref, s.amount, s.status, s.days]
        );
      } catch (e) {
        console.warn('[referral] sample commission insert failed, stopping seed:', e.code || e.message);
        return;
      }
    }
  }
}

export function createReferralRouter({ requireAuth }) {
  const r = express.Router();

  r.get('/summary', requireAuth, async (req, res, next) => {
    try {
      await ensureSeed(req.user.sub);
      const [totals, recent, payout] = await Promise.all([
        query(
          `SELECT
             COALESCE(SUM(amount_usdt) FILTER (WHERE status='settled'),0)::numeric  AS total_settled,
             COALESCE(SUM(amount_usdt) FILTER (WHERE status='pending'),0)::numeric  AS total_pending,
             COALESCE(SUM(amount_usdt),0)::numeric                                  AS total_accrued
           FROM referral_commissions
           WHERE affiliate_id=$1`,
          [req.user.sub]
        ),
        query(
          `SELECT id, source_type, source_ref, amount_usdt, status, created_at, settled_at
             FROM referral_commissions
             WHERE affiliate_id=$1
             ORDER BY created_at DESC
             LIMIT 20`,
          [req.user.sub]
        ),
        query(
          `SELECT payout_wallet, payout_chain, schedule, min_payout, asset
             FROM referral_payout_settings WHERE user_id=$1`,
          [req.user.sub]
        ),
      ]);
      // Funnel stats are deterministic dev numbers; in prod they come from analytics ETL
      let code = null, link = null;
      try {
        code = inviteCodeFromUser(req.user.sub);
        link = inviteLink(req, code);
      } catch (e) {
        // Never let invite-code generation crash the whole endpoint
        req.log?.warn({ err: e }, 'referral: invite code generation failed');
      }
      res.json({
        code,
        link,
        totals: totals.rows[0] || { total_settled: 0, total_pending: 0, total_accrued: 0 },
        recent: recent.rows,
        payout: payout.rows[0] || null,
        funnel: config.env === 'production'
          ? { clicks_30d: 0, signups_30d: 0, kyc_30d: 0, first_trade_30d: 0 }
          : { clicks_30d: 18420, signups_30d: 1284, kyc_30d: 742, first_trade_30d: 487 },
      });
    } catch (err) { next(err); }
  });

  r.get('/commissions', requireAuth, async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
      const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
      const { rows } = await query(
        `SELECT id, source_type, source_ref, amount_usdt, status, created_at, settled_at
           FROM referral_commissions
           WHERE affiliate_id=$1
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
        [req.user.sub, limit, offset]
      );
      res.json({ commissions: rows, limit, offset });
    } catch (err) { next(err); }
  });

  r.post('/payout', requireAuth, async (req, res, next) => {
    try {
      const input = payoutSchema.parse(req.body || {});
      await query(
        `INSERT INTO referral_payout_settings (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
        [req.user.sub]
      );
      const sets = [];
      const params = [req.user.sub];
      let idx = 2;
      for (const k of Object.keys(input)) {
        sets.push(`${k} = $${idx}`);
        params.push(input[k]);
        idx++;
      }
      sets.push(`updated_at = NOW()`);
      const { rows } = await query(
        `UPDATE referral_payout_settings SET ${sets.join(', ')}
           WHERE user_id=$1
        RETURNING payout_wallet, payout_chain, schedule, min_payout, asset, updated_at`,
        params
      );
      res.json({ payout: rows[0] });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  r.post('/claim', requireAuth, async (req, res, next) => {
    try {
      const { rows } = await query(
        `UPDATE referral_commissions
            SET status='queued'
          WHERE affiliate_id=$1 AND status='pending'
        RETURNING id, amount_usdt`,
        [req.user.sub]
      );
      const total = rows.reduce((s, r2) => s + Number(r2.amount_usdt || 0), 0);
      // Notification outbox
      await query(
        `INSERT INTO notifications_outbox (user_id, channel, template, payload)
         VALUES ($1, 'email', 'referral_claim_queued',
                 jsonb_build_object('count', $2, 'amount_usdt', $3))`,
        [req.user.sub, rows.length, total]
      );
      res.json({ queued: rows.length, total_usdt: total });
    } catch (err) { next(err); }
  });

  return r;
}

export default createReferralRouter;
