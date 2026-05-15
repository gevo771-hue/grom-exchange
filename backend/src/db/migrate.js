import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, withTx } from './pool.js';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, 'migrations');

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function appliedVersions() {
  const { rows } = await pool.query('SELECT version FROM schema_migrations');
  return new Set(rows.map((row) => row.version));
}

async function run() {
  await ensureMigrationsTable();
  const applied = await appliedVersions();
  const files = (await readdir(migrationsDir))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    await withTx(async (tx) => {
      await tx.query(sql);
      await tx.query(
        'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING',
        [file]
      );
    });
    logger.info({ file }, 'migration applied');
  }
}

run()
  .then(async () => {
    await pool.end();
  })
  .catch(async (err) => {
    logger.error({ err }, 'migration failed');
    await pool.end();
    process.exit(1);
  });
