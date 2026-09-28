import { query } from '../db/pool.js';
import logger from '../utils/logger.js';

/**
 * Append a client activity row (never throws — analytics must not break trading).
 */
export async function logUserActivity({
  userId = null,
  wallet = null,
  product,
  action,
  detail = {},
  txHash = null,
  amount = null,
  asset = null,
  status = null,
  createdAt = null,
}) {
  if (!product || !action) return false;
  try {
    // Dedupe on-chain fills — Instant Swap may retry log after SIWE.
    if (txHash) {
      const existing = await query(
        `SELECT 1 FROM user_activity WHERE tx_hash=$1 LIMIT 1`,
        [String(txHash)]
      );
      if (existing.rowCount > 0) return false;
    }
    if (createdAt) {
      await query(
        `INSERT INTO user_activity
           (user_id, wallet_address, product, action, detail, tx_hash, amount, asset, status, created_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10::timestamptz)`,
        [
          userId,
          wallet ? String(wallet).toLowerCase() : null,
          String(product),
          String(action),
          JSON.stringify(detail || {}),
          txHash || null,
          amount != null ? Number(amount) : null,
          asset || null,
          status || null,
          new Date(createdAt).toISOString(),
        ]
      );
    } else {
      await query(
        `INSERT INTO user_activity
           (user_id, wallet_address, product, action, detail, tx_hash, amount, asset, status)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)`,
        [
          userId,
          wallet ? String(wallet).toLowerCase() : null,
          String(product),
          String(action),
          JSON.stringify(detail || {}),
          txHash || null,
          amount != null ? Number(amount) : null,
          asset || null,
          status || null,
        ]
      );
    }
    return true;
  } catch (err) {
    logger.warn({ err: err.message, product, action }, 'user_activity log failed');
    return false;
  }
}

export default logUserActivity;
