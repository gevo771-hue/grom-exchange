const LEGACY_CUSTODIAL_MIGRATIONS = new Set([
  '027_wallet_signature_withdrawals.sql',
  '028_decommission_custodial.sql',
  '029_remove_custodial_schema.sql',
  '030_drop_custodial_ledger.sql',
  '031_drop_dead_custodial_challenges.sql',
]);

export function shouldDeferLegacyCustodialMigration(file, env = process.env) {
  return env.GROM_DEFER_LEGACY_CUSTODIAL === '1' && LEGACY_CUSTODIAL_MIGRATIONS.has(file);
}
