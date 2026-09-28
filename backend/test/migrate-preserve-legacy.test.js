import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldDeferLegacyCustodialMigration } from '../src/db/migration-policy.js';

const legacyMigrations = [
  '027_wallet_signature_withdrawals.sql',
  '028_decommission_custodial.sql',
  '029_remove_custodial_schema.sql',
  '030_drop_custodial_ledger.sql',
  '031_drop_dead_custodial_challenges.sql',
];

test('production preservation flag defers only legacy custodial migrations', () => {
  for (const file of legacyMigrations) {
    assert.equal(shouldDeferLegacyCustodialMigration(file, { GROM_DEFER_LEGACY_CUSTODIAL: '1' }), true, file);
    assert.equal(shouldDeferLegacyCustodialMigration(file, {}), false, file);
  }
  assert.equal(shouldDeferLegacyCustodialMigration('032_admin_audit_columns.sql', { GROM_DEFER_LEGACY_CUSTODIAL: '1' }), false);
  assert.equal(shouldDeferLegacyCustodialMigration('033_future_migration.sql', { GROM_DEFER_LEGACY_CUSTODIAL: '1' }), false);
});
