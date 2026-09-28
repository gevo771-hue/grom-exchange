import { randomUUID } from 'node:crypto';
import { query } from '../db/pool.js';
import logger from '../utils/logger.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeVisitorId(raw) {
  const s = String(raw || '').trim();
  return UUID_RE.test(s) ? s.toLowerCase() : randomUUID();
}

/** Never throws — analytics must not break the app. */
export async function logSitePageview({ visitorKey, page, userId = null, wallet = null }) {
  if (!visitorKey) return;
  try {
    await query(
      `INSERT INTO site_pageviews (visitor_key, page, user_id, wallet_address)
       VALUES ($1, $2, $3, $4)`,
      [
        visitorKey,
        String(page || 'unknown').slice(0, 64),
        userId || null,
        wallet ? String(wallet).toLowerCase() : null,
      ]
    );
  } catch (err) {
    logger.warn({ err: err.message, page }, 'site_pageview log failed');
  }
}

export default logSitePageview;
