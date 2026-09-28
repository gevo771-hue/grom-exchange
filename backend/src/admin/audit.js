import { query } from '../db/pool.js';
import config from '../config/index.js';

export async function logAdminAudit({
  actorId,
  action,
  targetId = null,
  targetType = null,
  reason = null,
  ip = null,
  metadata = {},
  ua = null,
}) {
  const payload = { ...(metadata || {}) };
  if (reason) payload.reason = reason;
  await query(
    `INSERT INTO admin_audit_log (actor_id, action, target_id, target_type, payload, ip, ua, ts)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, NOW())`,
    [actorId, action, targetId, targetType, JSON.stringify(payload), ip, ua]
  );
}

export function clientIp(req) {
  const peer = String(req.socket?.remoteAddress || req.ip || '').replace(/^::ffff:/, '');
  const trustedRaw = config.admin?.trustedProxies;
  const trusted = Array.isArray(trustedRaw) ? trustedRaw.map((x) => String(x).replace(/^::ffff:/, '')) : [];
  /* Empty list → ONLY loopback may spoof CF/XFF (never "trust all"). */
  const peerTrusted = trusted.includes(peer) || peer === '127.0.0.1' || peer === '::1'
    || (trusted.length === 0 && (peer === '127.0.0.1' || peer === '::1'));
  if (peerTrusted) {
    const cf = req.headers['cf-connecting-ip'];
    if (cf) return String(cf).trim();
    const xff = req.headers['x-forwarded-for'];
    if (xff) return String(xff).split(',')[0].trim();
  }
  return peer || req.ip || null;
}

export function auditRowToEntry(row) {
  const payload = row.payload || {};
  return {
    ...row,
    created_at: row.created_at || row.ts,
    reason: payload.reason || payload.summary || null,
    metadata: payload,
  };
}
