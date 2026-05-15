import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BinanceClient } from '../src/integrations/binance/client.js';
import { supportedBinanceNetworkPairs, toBinanceNetwork } from '../src/integrations/binance/network-map.js';
import { signAndBroadcastBinance } from '../src/wallet/signers/binance.js';
import { ensureDepositAddress } from '../src/wallet/binance-onboarding.js';

test('BinanceClient signs query strings with HMAC SHA256', () => {
  const client = new BinanceClient({ apiSecret: 'secret', apiKey: 'key', dryRun: true });
  assert.equal(
    client.sign('timestamp=1'),
    'c402d7b980cc9eabd875601df69f390fe7790d9ca1e140a3f62ec5f5d161e797'
  );
});

test('BinanceClient dry-run returns deterministic safe responses without credentials', async () => {
  const client = new BinanceClient({ dryRun: true });
  assert.deepEqual(await client.getWithdrawHistory({ coin: 'USDT' }), []);
  assert.equal((await client.getAccountStatus()).dryRun, true);
  assert.match((await client.withdraw({ coin: 'USDT', network: 'TRX', address: 'T', amount: '1' })).id, /^dryrun-/);
});

test('Binance backend maps frontend network names to Binance network names', () => {
  assert.equal(toBinanceNetwork('ARB'), 'ARBITRUM');
  assert.equal(toBinanceNetwork('TRON'), 'TRX');
  assert.equal(toBinanceNetwork('Polygon'), 'MATIC');
  assert.equal(toBinanceNetwork('BTC'), 'BTC');
  assert.equal(toBinanceNetwork('unknown'), null);
  assert.ok(supportedBinanceNetworkPairs().some((row) => row.asset === 'USDT' && row.network === 'TRON' && row.binanceNetwork === 'TRX'));
});

test('Binance signer dry-run returns dryrun ids and enforces stablecoin cap', async () => {
  const result = await signAndBroadcastBinance({
    asset: 'USDT',
    network: 'TRON',
    to: 'TXYZ',
    amount: 10,
    transferId: '00000000-0000-4000-8000-000000000001',
  });
  assert.equal(result.txHash, 'dryrun');
  await assert.rejects(
    () => signAndBroadcastBinance({ asset: 'USDT', network: 'TRON', to: 'TXYZ', amount: 1_000_000 }),
    /binance_withdrawal_limit_exceeded/
  );
});

test('Binance onboarding returns deterministic mock address on dry-run/testnet without API calls', async () => {
  const address = await ensureDepositAddress('user-1', 'USDT', 'TRON', {
    async createVirtualSubAccount() {
      throw new Error('must_not_call_subaccount_api');
    },
    async getSubAccountDepositAddress() {
      throw new Error('must_not_call_deposit_api');
    },
  });
  assert.equal(address.asset, 'USDT');
  assert.equal(address.network, 'TRON');
  assert.match(address.address, /^dryrun_[a-f0-9]{30}$/);
  const again = await ensureDepositAddress('user-1', 'USDT', 'TRON');
  assert.equal(again.address, address.address);
});

test('Binance backend migration and routes expose required production hooks', () => {
  const migration = fs.readFileSync(new URL('../src/db/migrations/012_binance_backend.sql', import.meta.url), 'utf8');
  assert.match(migration, /binance_subaccounts/);
  assert.match(migration, /binance_deposit_addresses/);
  assert.match(migration, /binance_withdrawal_log/);
  assert.match(migration, /binance_deposit_id/);

  const adminRoutes = fs.readFileSync(new URL('../src/admin/routes.js', import.meta.url), 'utf8');
  assert.match(adminRoutes, /\/binance\/status/);
  assert.match(adminRoutes, /\/binance\/test-call/);
  assert.match(adminRoutes, /\/binance\/withdrawals/);
});
