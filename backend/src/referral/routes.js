import express from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db/pool.js';
import { ensureReferralCode, ensurePublicReferralCode, normalizeReferralWallet } from './invite.js';

const summaryLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { error: 'rate_limited' },
});

export default function createReferralRouter({ requireAuth, publicCode = ensurePublicReferralCode }) {
  const router = express.Router();

  router.get('/referral/link', summaryLimiter, async (req, res, next) => {
    const wallet = normalizeReferralWallet(req.query.wallet);
    if (!wallet) return res.status(400).json({ error: 'invalid_wallet' });
    try {
      const code = await publicCode(wallet);
      res.set('Cache-Control', 'no-store');
      // No JWT, counts, account id, private data, or account creation here.
      return res.json({ code: `GROM-${code}`, link: `/r/${code}` });
    } catch (err) { next(err); }
  });

  router.get('/referral/summary', requireAuth, summaryLimiter, async (req, res, next) => {
    try {
      const userId = req.user?.sub;
      if (!userId) return res.status(401).json({ error: 'unauthorized' });

      const code = await ensureReferralCode(userId);
      const { rows } = await query(
        `SELECT
           COUNT(*)::int AS total_referred,
           COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS signups_30d,
           COUNT(*) FILTER (
             WHERE COALESCE(last_seen_at, created_at) >= NOW() - INTERVAL '30 days'
           )::int AS active_30d
         FROM users
         WHERE referred_by=$1 OR referred_by_wallet=(SELECT wallet_address FROM users WHERE id=$1)`,
        [userId]
      );
      const stats = rows[0] || {};
      const displayCode = `GROM-${code}`;
      const link = `/r/${code}`;

      res.set('Cache-Control', 'no-store');
      res.json({
        code: displayCode,
        link,
        tracking: 'active',
        rewards: 'inactive',
        totals: { total_referred: Number(stats.total_referred) || 0 },
        funnel: {
          signups_30d: Number(stats.signups_30d) || 0,
          active_30d: Number(stats.active_30d) || 0,
        },
      });
    } catch (err) { next(err); }
  });

  return router;
}
