import express from 'express';
import { query } from '../db/pool.js';
import config from '../config/index.js';
import SumsubClient, { extractExternalUserId, mapSumsubKycStatus, verifyWebhook } from './sumsub.js';

export default function createKycRouter({ requireAuth, client = new SumsubClient() } = {}) {
  const r = express.Router();

  r.post('/start', requireAuth, async (req, res, next) => {
    try {
      const userId = req.user.sub;
      const levelName = String(req.body?.levelName || config.kyc.sumsub.levelName);
      const token = await client.generateAccessToken({ userId, levelName });
      await query(
        `UPDATE users
            SET kyc_provider='sumsub',
                kyc_external_id=$2,
                kyc_status='pending',
                kyc_level=$3,
                kyc_started_at=COALESCE(kyc_started_at, NOW())
          WHERE id=$1`,
        [userId, token.externalUserId, levelName]
      );
      res.json({ sdkToken: token.sdkToken, levelName, provider: 'sumsub' });
    } catch (err) { next(err); }
  });

  r.get('/status', requireAuth, async (req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT kyc_status, kyc_level, kyc_provider, kyc_started_at, kyc_completed_at
           FROM users WHERE id=$1`,
        [req.user.sub]
      );
      const row = rows[0] || {};
      res.json({
        status: row.kyc_status || 'none',
        level: row.kyc_level || 'tier_0',
        provider: row.kyc_provider || 'sumsub',
        started_at: row.kyc_started_at || null,
        completed_at: row.kyc_completed_at || null,
      });
    } catch (err) { next(err); }
  });

  r.post('/webhook', async (req, res, next) => {
    try {
      const rawBody = req.rawBody || JSON.stringify(req.body || {});
      if (!verifyWebhook({ headers: req.headers, body: rawBody })) {
        return res.status(401).json({ error: 'invalid_signature' });
      }
      const payload = req.body || {};
      const externalUserId = extractExternalUserId(payload);
      const status = mapSumsubKycStatus(payload);
      const completed = ['verified', 'rejected'].includes(status);

      await query(
        `INSERT INTO kyc_webhooks(provider, external_user_id, review_status, payload, signature, processed_at)
         VALUES ('sumsub', $1, $2, $3::jsonb, $4, NOW())`,
        [
          externalUserId,
          payload.reviewStatus || payload.reviewResult?.reviewAnswer || status,
          JSON.stringify(payload),
          req.headers['x-payload-digest'] || req.headers['x-sumsub-signature'] || '',
        ]
      );

      if (externalUserId) {
        await query(
          `UPDATE users
              SET kyc_provider='sumsub',
                  kyc_external_id=COALESCE(kyc_external_id, $1),
                  kyc_status=$2,
                  kyc_level=COALESCE(kyc_level, $3),
                  kyc_completed_at=CASE WHEN $4 THEN NOW() ELSE kyc_completed_at END
            WHERE kyc_external_id=$1 OR id::text=REPLACE($1, 'grom-', '')`,
          [externalUserId, status, config.kyc.sumsub.levelName, completed]
        );
      }
      res.json({ ok: true, status });
    } catch (err) { next(err); }
  });

  return r;
}
