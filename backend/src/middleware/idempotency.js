import crypto from 'node:crypto';
import { query } from '../db/pool.js';
import logger from '../utils/logger.js';

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

export function requestFingerprint(req) {
  const body = req.body == null ? null : req.body;
  return crypto
    .createHash('sha256')
    .update(`${req.method}:${req.originalUrl || req.url}:${stableStringify(body)}`)
    .digest('hex');
}

export function idempotencyMiddleware(scope) {
  return async (req, res, next) => {
    const key = String(req.headers['idempotency-key'] || '').trim();
    if (!key) return next();
    if (!req.user?.sub) return res.status(401).json({ error: 'idempotency_requires_auth' });

    const routeKey = `http:${scope}:${key}`;
    const requestHash = requestFingerprint(req);

    try {
      const existing = await query(
        `SELECT request_hash, response_code, response_body
           FROM idempotency_keys
          WHERE user_id=$1 AND route_key=$2 AND expires_at > NOW()`,
        [req.user.sub, routeKey]
      );
      if (existing.rows[0]) {
        const row = existing.rows[0];
        if (row.request_hash !== requestHash) {
          return res.status(409).json({ error: 'idempotency_key_reused_with_different_payload' });
        }
        if (row.response_body != null) {
          return res.status(200).json(row.response_body);
        }
        return res.status(409).json({ error: 'idempotency_request_in_progress' });
      }

      await query(
        `INSERT INTO idempotency_keys (user_id, route_key, request_hash)
         VALUES ($1, $2, $3)`,
        [req.user.sub, routeKey, requestHash]
      );

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (res.statusCode < 500) {
          query(
            `UPDATE idempotency_keys
                SET response_code=$3, response_body=$4::jsonb
              WHERE user_id=$1 AND route_key=$2`,
            [req.user.sub, routeKey, res.statusCode || 200, JSON.stringify(body ?? {})]
          ).catch((err) => logger.warn({ err: err.message, routeKey }, 'idempotency response save failed'));
        }
        return originalJson(body);
      };
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

export default idempotencyMiddleware;
