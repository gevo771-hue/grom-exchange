#!/usr/bin/env node
/** Run SQL migrations in src/db/migrations/ (sorted by filename). */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';
import { shouldDeferLegacyCustodialMigration } from './migration-policy.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const migDir = join(__dir, 'migrations');

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const { rows } = await pool.query('SELECT 1 FROM schema_migrations WHERE version=$1', [file]);
    if (rows.length) {
      console.log('skip', file);
      continue;
    }
    if (shouldDeferLegacyCustodialMigration(file)) {
      console.log('defer', file, '(GROM_DEFER_LEGACY_CUSTODIAL=1; preserving legacy data)');
      continue;
    }
    const sql = readFileSync(join(migDir, file), 'utf8');
    console.log('apply', file);
    await pool.query(sql);
    await pool.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
  }
  await pool.end();
  console.log('done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
