import { query } from '../db/pool.js';

export function maintenanceMiddleware() {
  return async (req, res, next) => {
    if (req.path === '/health' || req.path.startsWith('/api/admin')) return next();
    try {
      const { rows } = await query(`SELECT value FROM settings WHERE key='maintenance_mode'`);
      if (rows[0]?.value === true || rows[0]?.value === 'true') {
        return res.status(503).json({ error: 'maintenance_mode' });
      }
    } catch (err) {
      if (err.code !== '42P01') return next(err);
    }
    return next();
  };
}

export default maintenanceMiddleware;
