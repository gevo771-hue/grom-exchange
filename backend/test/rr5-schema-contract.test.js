/**
 * RR5-02/01 schema-contract: after migrations, auth/admin SQL shapes exist;
 * legacy email/CEX tables stay absent.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migDir = join(__dirname, '../src/db/migrations');
const requirePg = process.env.GROM_REQUIRE_PG === '1';
const hasDb = !!(process.env.DATABASE_URL || process.env.GROM_DB_URL);
if (requirePg && !hasDb) throw new Error('PostgreSQL required (set DATABASE_URL)');
const describeDb = hasDb ? describe : describe.skip;

function dbUrlFromEnv() {
  return process.env.DATABASE_URL || process.env.GROM_DB_URL;
}

describeDb('RR5 schema-contract after clean migrate', () => {
  it('users.status/role, user_settings, admin_audit_log exist; email/CEX tables absent', async () => {
    const baseUrl = dbUrlFromEnv();
    const admin = new pg.Client({ connectionString: baseUrl });
    await admin.connect();
    const dbName = `grom_schema_${Date.now()}`;
    try { await admin.query(`CREATE DATABASE ${dbName}`); } finally { await admin.end(); }
    const u = new URL(baseUrl);
    u.pathname = `/${dbName}`;
    const client = new pg.Client({ connectionString: u.toString() });
    await client.connect();
    try {
      const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
      for (const file of files) {
        await client.query(readFileSync(join(migDir, file), 'utf8'));
      }
      // Columns
      for (const col of ['status', 'role']) {
        const { rows } = await client.query(
          `SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='users' AND column_name=$1`,
          [col],
        );
        assert.equal(rows.length, 1, `users.${col} required`);
      }
      // Tables present
      for (const table of ['user_settings', 'admin_audit_log']) {
        const { rows } = await client.query(
          `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
          [table],
        );
        assert.equal(rows.length, 1, `${table} required`);
      }
      // Legacy absent
      for (const table of ['notifications_outbox', 'symbols', 'alerts', 'wallet_action_challenges']) {
        const { rows } = await client.query(
          `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
          [table],
        );
        assert.equal(rows.length, 0, `${table} must not exist`);
      }
      // No email column on user_settings
      const { rows: emailCol } = await client.query(
        `SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='user_settings' AND column_name='email'`,
      );
      assert.equal(emailCol.length, 0, 'user_settings.email must not exist');

      // Live SQL smoke (auth/admin shapes) — columns required by logAdminAudit()
      for (const col of ['target_type', 'ua', 'target_id', 'payload', 'ip', 'ts']) {
        const { rows } = await client.query(
          `SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='admin_audit_log' AND column_name=$1`,
          [col],
        );
        assert.equal(rows.length, 1, `admin_audit_log.${col} required`);
      }
      await client.query(
        `INSERT INTO users (wallet_address, chain_id, status, role)
         VALUES ('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 1, 'active', 'user')
         RETURNING id, status, role`
      );
      const { rows: urows } = await client.query(
        `SELECT u.status, u.role,
                (SELECT security->>'forced_logout_at' FROM user_settings WHERE user_id=u.id) AS forced_logout_at
           FROM users u WHERE wallet_address=$1`,
        ['0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
      );
      assert.equal(urows[0].status, 'active');
      assert.equal(urows[0].role, 'user');
      /* Exact SQL shape used by logAdminAudit() */
      await client.query(
        `INSERT INTO admin_audit_log (actor_id, action, target_id, target_type, payload, ip, ua, ts)
         VALUES (NULL, 'schema_contract_logAdminAudit', 'user-1', 'user', '{}'::jsonb, '127.0.0.1', 'test', NOW())`
      );
      const { rows: auditRows } = await client.query(
        `SELECT target_type, ua FROM admin_audit_log WHERE action='schema_contract_logAdminAudit' LIMIT 1`
      );
      assert.equal(auditRows[0].target_type, 'user');
      assert.equal(auditRows[0].ua, 'test');
    } finally {
      await client.end();
      const drop = new pg.Client({ connectionString: baseUrl });
      await drop.connect();
      await drop.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(() =>
        drop.query(`DROP DATABASE IF EXISTS ${dbName}`)
      );
      await drop.end();
    }
  });

  it('upgrade path: 001+018+… then late 002 still applies', async () => {
    const baseUrl = dbUrlFromEnv();
    const admin = new pg.Client({ connectionString: baseUrl });
    await admin.connect();
    const dbName = `grom_upg_${Date.now()}`;
    try { await admin.query(`CREATE DATABASE ${dbName}`); } finally { await admin.end(); }
    const u = new URL(baseUrl);
    u.pathname = `/${dbName}`;
    const client = new pg.Client({ connectionString: u.toString() });
    await client.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      // Simulate old prod: 001 then skip 002, apply 018+ with manually created user_settings
      await client.query(readFileSync(join(migDir, '001_init.sql'), 'utf8'));
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', ['001_init.sql']);
      /* Legacy CEX role column without check — market_maker must normalize away in 002 */
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`);
      await client.query(`
        INSERT INTO users (wallet_address, chain_id, status, role)
        VALUES ('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 1, 'active', 'market_maker')
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_settings (
          user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          security JSONB NOT NULL DEFAULT '{}'::jsonb,
          notifications JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      const rest = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()
        .filter((f) => f !== '001_init.sql' && f !== '002_active_wallet_schema.sql' && f !== '032_admin_audit_columns.sql');
      for (const file of rest) {
        await client.query(readFileSync(join(migDir, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
      }
      // Now apply 002 (idempotent) as upgrade, then ensure 032 columns
      await client.query(readFileSync(join(migDir, '002_active_wallet_schema.sql'), 'utf8'));
      await client.query(readFileSync(join(migDir, '032_admin_audit_columns.sql'), 'utf8'));
      const { rows } = await client.query(
        `SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='users' AND column_name='status'`,
      );
      assert.equal(rows.length, 1);
      const { rows: role } = await client.query(
        `SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='users' AND column_name='role'`,
      );
      assert.equal(role.length, 1);
      const { rows: mm } = await client.query(
        `SELECT role FROM users WHERE wallet_address='0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'`
      );
      assert.equal(mm[0].role, 'user', 'market_maker must become user');
      const { rows: mmLeft } = await client.query(
        `SELECT count(*)::int AS n FROM users WHERE role='market_maker'`
      );
      assert.equal(mmLeft[0].n, 0);
      /* Constraint rejects market_maker */
      let rejected = false;
      try {
        await client.query(
          `INSERT INTO users (wallet_address, chain_id, status, role)
           VALUES ('0xcccccccccccccccccccccccccccccccccccccccc', 1, 'active', 'market_maker')`
        );
      } catch (_) { rejected = true; }
      assert.equal(rejected, true, 'users_role_check must reject market_maker');
      const { rows: audit } = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name='admin_audit_log'`,
      );
      assert.equal(audit.length, 1);
      for (const col of ['target_type', 'ua']) {
        const { rows: c } = await client.query(
          `SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='admin_audit_log' AND column_name=$1`,
          [col],
        );
        assert.equal(c.length, 1, `admin_audit_log.${col}`);
      }
      await client.query(
        `INSERT INTO admin_audit_log (actor_id, action, target_id, target_type, payload, ip, ua, ts)
         VALUES (NULL, 'upgrade_logAdminAudit', 'u1', 'user', '{}'::jsonb, '127.0.0.1', 'test', NOW())`
      );
    } finally {
      await client.end();
      const drop = new pg.Client({ connectionString: baseUrl });
      await drop.connect();
      await drop.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(() =>
        drop.query(`DROP DATABASE IF EXISTS ${dbName}`)
      );
      await drop.end();
    }
  });
});
