import { query } from '../db/pool.js';

export function marketGate(product) {
  return async (req, res, next) => {
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) return next();
    try {
      const { rows } = await query(
        `SELECT paused, killed, reason FROM product_status WHERE product=$1`,
        [product]
      );
      const status = rows[0];
      if (status?.paused || status?.killed) {
        return res.status(423).json({
          error: 'market_paused',
          product,
          reason: status.reason || null,
          killed: Boolean(status.killed),
        });
      }
    } catch (err) {
      if (err.code !== '42P01') return next(err);
    }
    return next();
  };
}

export default marketGate;
