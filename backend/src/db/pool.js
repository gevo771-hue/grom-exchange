import pg from 'pg';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const { Pool } = pg;

export const pool = new Pool(config.db);

pool.on('error', (err) => {
  logger.error({ err }, 'Postgres pool error');
});

export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const dur = Date.now() - start;
    if (dur > 200) logger.warn({ dur, text: text.slice(0, 80) }, 'Slow query');
    return res;
  } catch (err) {
    logger.error({ err, text: text.slice(0, 80) }, 'Query failed');
    throw err;
  }
}

export async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
