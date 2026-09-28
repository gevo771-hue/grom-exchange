import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapLifiTransferToFill,
  integratorFeeUsdFromTransfer,
  LIFI_INTEGRATOR,
} from '../src/dimensions/lifi-sync.js';

const sample = {
  transactionId: '0xabc',
  status: 'DONE',
  tool: 'nordstern',
  fromAddress: '0xe61e6d7bdc744b2c7d49d42c6b727c988aceac79',
  metadata: { integrator: 'grom-exchange' },
  sending: {
    txHash: '0xa3cbba397e955eb68456360e5713b7c83a2f0113cec127f5a0c5aa917ca624b9',
    chainId: 56,
    amountUSD: '3.6432',
    amount: '3644141020000000000',
    timestamp: 1787422817,
    token: { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, symbol: 'USDT' },
  },
  receiving: {
    txHash: '0xa3cbba397e955eb68456360e5713b7c83a2f0113cec127f5a0c5aa917ca624b9',
    chainId: 56,
    amountUSD: '3.6324',
    amount: '3634354584228528358',
    timestamp: 1787422817,
    token: { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, symbol: 'USDC' },
  },
  feeCosts: [
    {
      amountUSD: '0.0091',
      amount: '9110352550000000',
      feeSplit: { integratorFee: '0', lifiFee: '9110352550000000' },
    },
  ],
};

describe('mapLifiTransferToFill', () => {
  it('maps DONE grom-exchange transfer with historical USD volume', () => {
    const fill = mapLifiTransferToFill(sample);
    assert.ok(fill);
    assert.equal(fill.product, 'swap');
    assert.equal(fill.chainId, 56);
    assert.equal(fill.status, 'confirmed');
    assert.equal(fill.attribution, `lifi:${LIFI_INTEGRATOR}`);
    assert.equal(fill.volumeUsd, 3.6432);
    assert.equal(fill.feeUsd, 0);
    assert.equal(fill.executedAt, '2026-08-22T18:20:17.000Z');
  });

  it('rejects other integrators and non-DONE', () => {
    assert.equal(
      mapLifiTransferToFill({ ...sample, metadata: { integrator: 'other' } }),
      null
    );
    assert.equal(mapLifiTransferToFill({ ...sample, status: 'PENDING' }), null);
  });

  it('computes integrator fee share when present', () => {
    const fee = integratorFeeUsdFromTransfer({
      feeCosts: [
        {
          amountUSD: '1.0',
          amount: '100',
          feeSplit: { integratorFee: '40', lifiFee: '60' },
        },
      ],
    });
    assert.equal(fee, 0.4);
  });
});
