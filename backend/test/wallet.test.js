import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHistoryItems, summariseBalances } from '../src/wallet/routes.js';

test('summariseBalances computes totals, available USD, and allocation ordering', () => {
  const result = summariseBalances(
    [
      { asset: 'BTC', amount: '0.1', locked: '0.01' },
      { asset: 'USDT', amount: '500', locked: '0' },
    ],
    { BTC: 100000, USDT: 1 }
  );

  assert.equal(result.assets.length, 2);
  assert.equal(result.totalUsd, 10500);
  assert.equal(result.availableUsd, 9500);
  assert.equal(result.assets[0].asset, 'BTC');
  assert.equal(result.allocation[0].asset, 'BTC');
  assert.equal(result.allocation[0].sharePct, 95.2);
});

test('buildHistoryItems merges transfers, binary and spot rows in reverse chronological order', () => {
  const items = buildHistoryItems({
    transfers: [
      {
        direction: 'deposit',
        asset: 'USDT',
        address: '0xabc123456789',
        amount: '250',
        status: 'completed',
        created_at: '2026-04-19T10:00:00.000Z',
      },
    ],
    binaryPositions: [
      {
        direction: 'up',
        stake: '25',
        payout: '21.75',
        placed_at: '2026-04-19T09:00:00.000Z',
        asset: 'BTC/USDT',
        duration_sec: 60,
      },
    ],
    spotOrders: [
      {
        pair: 'ETH/USDT',
        side: 'sell',
        price: '3600',
        amount: '0.01',
        filled: '0.01',
        status: 'filled',
        created_at: '2026-04-19T11:00:00.000Z',
      },
    ],
  });

  assert.equal(items.length, 3);
  assert.equal(items[0].kind, 'spot');
  assert.equal(items[1].kind, 'deposits');
  assert.equal(items[2].kind, 'binary');
  assert.equal(items[2].resultLabel, '+$21.75');
});
