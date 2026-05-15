import test from 'node:test';
import assert from 'node:assert/strict';

import { signAndBroadcastEvm } from '../src/wallet/signers/evm.js';
import { signAndBroadcastWithdrawal } from '../src/wallet/signers/index.js';
import { signAndBroadcastTrc20, toTronBaseUnits } from '../src/wallet/signers/tron.js';
import {
  buildSignedPsbt,
  estimateFeeSats,
  keyPairFromWif,
  paymentFromKeyPair,
  selectUtxos,
  signAndBroadcastBitcoin,
  validateBitcoinAddress,
} from '../src/wallet/signers/bitcoin.js';
import { requiredConfirmations } from '../src/wallet/confirmation-watcher.js';

test('EVM signer dryRun returns tx hash without RPC', async () => {
  const result = await signAndBroadcastEvm({
    asset: 'USDT',
    network: 'ETH',
    to: '0x0000000000000000000000000000000000000001',
    amount: 10,
    dryRun: true,
  });
  assert.equal(result.dryRun, true);
  assert.match(result.txHash, /^0x[0-9a-f]{64}$/);
});

test('signer router dispatches TRON/BTC dry-run adapters', async () => {
  const tron = await signAndBroadcastWithdrawal({ asset: 'USDT', network: 'TRON', to: 'T...', amount: 1 });
  const btc = await signAndBroadcastWithdrawal({ asset: 'BTC', network: 'BTC', to: 'bc1...', amount: 0.01 });
  assert.equal(tron.dryRun, true);
  assert.equal(btc.dryRun, true);
});

test('confirmation thresholds map networks', () => {
  assert.equal(requiredConfirmations('ETH'), 12);
  assert.equal(requiredConfirmations('TRC-20'), 19);
  assert.equal(requiredConfirmations('BTC'), 6);
});

test('TRON signer broadcasts TRC20 transfer with mocked TronWeb', async () => {
  let sent = false;
  const tronWeb = {
    isAddress: () => true,
    defaultAddress: { base58: 'TMockHot' },
    contract: () => ({
      at: async () => ({
        transfer: (to, amount) => ({
          send: async () => {
            sent = { to, amount };
            return 'tron-tx-id';
          },
        }),
      }),
    }),
  };
  const result = await signAndBroadcastTrc20({
    asset: 'USDT',
    to: 'TReceiver',
    amount: 1.25,
    dryRun: false,
    tronWeb,
  });
  assert.equal(result.txHash, 'tron-tx-id');
  assert.deepEqual(sent, { to: 'TReceiver', amount: '1250000' });
  assert.equal(toTronBaseUnits(0.1), '100000');
});

test('TRON invalid address fails before send', async () => {
  let called = false;
  const tronWeb = {
    isAddress: () => false,
    contract: () => ({ at: async () => { called = true; } }),
  };
  await assert.rejects(
    () => signAndBroadcastTrc20({ asset: 'USDT', to: 'bad', amount: 1, dryRun: false, tronWeb }),
    /invalid_tron_address/
  );
  assert.equal(called, false);
});

test('BTC coin selection includes dust change in fee', () => {
  const selected = selectUtxos([
    { txid: 'a'.repeat(64), vout: 0, value: 10_600 },
  ], 10_000, 1);
  assert.equal(selected.change < 546, true);
  assert.equal(estimateFeeSats(1, 2, 1), 140);
});

test('BTC invalid address throws before broadcast', async () => {
  assert.throws(() => validateBitcoinAddress('not-btc'), /invalid_bitcoin_address/);
  let broadcastCalled = false;
  const fetchImpl = async (url, opts = {}) => {
    if (String(url).endsWith('/tx') && opts.method === 'POST') broadcastCalled = true;
    return { ok: true, json: async () => [], text: async () => '' };
  };
  await assert.rejects(
    () => signAndBroadcastBitcoin({ to: 'not-btc', amount: 0.001, dryRun: false, fetchImpl }),
    /invalid_bitcoin_address/
  );
  assert.equal(broadcastCalled, false);
});

test('BTC PSBT builds and signs from mocked P2WPKH UTXO', async () => {
  const keyPair = keyPairFromWif('L3JS3syZUAhNnqAZuVAaoD2baL3CnevjB7cNVF3cQ4hs2FwHvGiq');
  const payment = paymentFromKeyPair(keyPair);
  const result = await buildSignedPsbt({
    to: 'bc1qtyrxte8cdyl8g9tr98yr6jqw9k5p9xtxgw8d83',
    amount: 0.0001,
    changeAddress: payment.address,
    utxos: [{ txid: 'b'.repeat(64), vout: 0, value: 25_000, script: Buffer.from(payment.output).toString('hex') }],
    keyPair,
    feeRateSatVb: 1,
  });
  assert.match(result.hex, /^[0-9a-f]+$/);
  assert.equal(result.inputCount, 1);
  assert.equal(result.fee > 0, true);
});
