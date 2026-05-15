import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('wallet security migrations include OTP, whitelist, queue, audit and webhook replay tables', () => {
  const sprint1 = `${read('src/db/migrations/005_wallet_security.sql')}\n${read('src/db/migrations/006_sprint1_finalize.sql')}\n${read('src/db/migrations/007_realtime_notifications.sql')}`;
  for (const table of [
    'two_fa_secrets',
    'address_whitelist',
    'deposit_addresses',
    'wallet_audit',
    'withdrawal_queue',
    'idempotency_keys',
    'webhook_events',
    'sweep_transfers',
  ]) {
    assert.match(sprint1, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(sprint1, /next_attempt_at/);
});

test('wallet routes expose OTP confirmation, whitelist and provider webhooks', () => {
  const routes = read('src/wallet/routes.js');
  assert.match(routes, /\/wallet\/withdrawals\/:id\/confirm-otp/);
  assert.match(routes, /\/wallet\/whitelist/);
  assert.match(routes, /\/webhooks\/moonpay/);
  assert.match(routes, /\/webhooks\/transak/);
  assert.match(routes, /webhook_events/);
});

test('admin routes expose withdrawal review, reserves and dead-letter endpoints', () => {
  const routes = read('src/admin/routes.js');
  assert.match(routes, /\/withdrawals\/:id\/approve/);
  assert.match(routes, /\/withdrawals\/:id\/reject/);
  assert.match(routes, /\/wallet\/reserves/);
  assert.match(routes, /\/wallet\/sweep-now/);
  assert.match(routes, /\/notifications\/dead-letters/);
});

test('production backoffice migration exposes controls, audit, symbols and alerts', () => {
  const migration = read('src/db/migrations/013_backoffice_production.sql');
  for (const table of ['settings', 'admin_audit_log', 'product_status', 'symbols', 'alerts']) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(migration, /maintenance_mode/);
  assert.match(migration, /daily_withdrawal_usd/);
});

test('production backoffice routes expose users, markets, symbols, treasury and maintenance', () => {
  const routes = read('src/admin/routes.js');
  for (const pattern of [
    /\/maintenance\/toggle/,
    /\/treasury\/summary/,
    /\/users/,
    /\/markets\/:product\/pause/,
    /\/markets\/:product\/kill/,
    /\/symbols/,
    /\/audit/,
    /\/alerts/,
    /\/reports\/daily/,
    /\/email\/test/,
    /\/email\/check-domain/,
  ]) {
    assert.match(routes, pattern);
  }
});
