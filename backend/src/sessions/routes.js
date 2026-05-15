/**
 * Session / device management.
 *   GET    /api/sessions
 *   POST   /api/sessions/touch       — record a heartbeat for the current session
 *   POST   /api/sessions/:id/protect — toggle protect flag
 *   DELETE /api/sessions/:id         — revoke
 *   POST   /api/sessions/email-summary
 */
import express from 'express';
import { query } from '../db/pool.js';

function shortDevice(ua) {
  if (!ua) return 'Unknown device';
  if (/iPhone|iPad/.test(ua)) return 'iOS · Safari';
  if (/Android/.test(ua)) return 'Android · Chrome';
  if (/Mac OS X/.test(ua) && /Chrome/.test(ua)) return 'macOS · Chrome';
  if (/Mac OS X/.test(ua)) return 'macOS · Safari';
  if (/Windows/.test(ua) && /Chrome/.test(ua)) return 'Windows · Chrome';
  if (/Linux/.test(ua)) return 'Linux · Browser';
  return ua.slice(0, 80);
}

export function createSessionsRouter({ requireAuth }) {
  const r = express.Router();

  r.get('/', requireAuth, async (req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT id, device_label, ip_address::text AS ip_address, user_agent,
                is_protected, revoked_at, last_seen_at, created_at
           FROM user_sessions
           WHERE user_id=$1
           ORDER BY revoked_at NULLS FIRST, last_seen_at DESC
           LIMIT 50`,
        [req.user.sub]
      );
      res.json({ sessions: rows });
    } catch (err) { next(err); }
  });

  r.post('/touch', requireAuth, async (req, res, next) => {
    try {
      const ua = req.headers['user-agent'] || '';
      const ip = (req.headers['x-forwarded-for']?.split(',')[0] || req.ip || '').trim() || null;
      const label = shortDevice(ua);
      // Upsert by jwt jti (we don't have jti, use simple device+ua match)
      const existing = await query(
        `SELECT id FROM user_sessions
           WHERE user_id=$1 AND user_agent=$2 AND COALESCE(ip_address::text,'')=COALESCE($3,'') AND revoked_at IS NULL
         LIMIT 1`,
        [req.user.sub, ua, ip]
      );
      if (existing.rowCount) {
        await query(`UPDATE user_sessions SET last_seen_at=NOW() WHERE id=$1`, [existing.rows[0].id]);
        return res.json({ session_id: existing.rows[0].id });
      }
      const { rows } = await query(
        `INSERT INTO user_sessions (user_id, device_label, ip_address, user_agent)
         VALUES ($1, $2, $3::inet, $4)
         RETURNING id`,
        [req.user.sub, label, ip, ua]
      );
      res.json({ session_id: rows[0].id });
    } catch (err) { next(err); }
  });

  r.post('/:id/protect', requireAuth, async (req, res, next) => {
    try {
      const { protected: prot } = req.body || {};
      const { rows } = await query(
        `UPDATE user_sessions
            SET is_protected=$3
          WHERE id=$1 AND user_id=$2
        RETURNING id, is_protected`,
        [req.params.id, req.user.sub, Boolean(prot)]
      );
      if (!rows.length) return res.status(404).json({ error: 'not_found' });
      res.json({ session: rows[0] });
    } catch (err) { next(err); }
  });

  r.delete('/:id', requireAuth, async (req, res, next) => {
    try {
      const { rows } = await query(
        `UPDATE user_sessions
            SET revoked_at=NOW()
          WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND is_protected=FALSE
        RETURNING id`,
        [req.params.id, req.user.sub]
      );
      if (!rows.length) return res.status(409).json({ error: 'protected_or_already_revoked' });
      res.json({ ok: true, revoked_id: rows[0].id });
    } catch (err) { next(err); }
  });

  r.post('/email-summary', requireAuth, async (req, res, next) => {
    try {
      await query(
        `INSERT INTO notifications_outbox (user_id, channel, template, payload)
         VALUES ($1, 'email', 'sessions_summary', '{}'::jsonb)`,
        [req.user.sub]
      );
      res.json({ ok: true, queued: true });
    } catch (err) { next(err); }
  });

  return r;
}

export default createSessionsRouter;
