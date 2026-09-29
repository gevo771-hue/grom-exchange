/**
 * RR6-01 — Real logAdminAudit() against migrated DATABASE_URL.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const hasDb = !!(process.env.DATABASE_URL || process.env.GROM_DB_URL);
const requirePg = process.env.GROM_REQUIRE_PG === '1';
if (requirePg && !hasDb) throw new Error('PostgreSQL required (set DATABASE_URL)');
const describeDb = hasDb ? describe : describe.skip;

describeDb('RR6 logAdminAudit integration', () => {
  it('logAdminAudit inserts target_type and ua', async () => {
    const { logAdminAudit } = await import('../src/admin/audit.js');
    const { query } = await import('../src/db/pool.js');
    const action = `rr6_audit_${Date.now()}`;
    await logAdminAudit({
      actorId: null,
      action,
      targetId: 'user-rr6',
      targetType: 'user',
      ua: 'test',
      ip: '127.0.0.1',
      metadata: { smoke: true },
    });
    const { rows } = await query(
      `SELECT target_type, ua, payload FROM admin_audit_log WHERE action=$1 ORDER BY ts DESC LIMIT 1`,
      [action],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].target_type, 'user');
    assert.equal(rows[0].ua, 'test');
    assert.equal(rows[0].payload?.smoke, true);
  });
});
