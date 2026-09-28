import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidBitcoinAddress,
  extractThorDepositMemo,
} from '../src/liquidity/btc-address.js';
import { normalizeLifiBridgeStatus, SWAP_OUTCOMES } from '../src/liquidity/lifi-status.js';

describe('isValidBitcoinAddress', () => {
  it('accepts well-known mainnet P2PKH / P2SH / bech32', () => {
    // Satoshi genesis-era style / documented examples with valid checksums
    assert.equal(isValidBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'), true);
    // Generated P2SH (ver=0x05) with valid Base58Check — not the common fake "3J98…" example
    assert.equal(isValidBitcoinAddress('31nM1WuowNDzocNxPPW9NQWJEtwWpjfcLj'), true);
    assert.equal(isValidBitcoinAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'), true);
  });

  it('rejects loose regex false positives', () => {
    assert.equal(isValidBitcoinAddress('bc1qinvalidchecksumxxxxxxxxxxxxxxxxxxxxxxx'), false);
    assert.equal(isValidBitcoinAddress('1AGNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW62iX'), false); // bad checksum
    assert.equal(isValidBitcoinAddress('not-a-btc-address'), false);
    assert.equal(isValidBitcoinAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0'), false);
  });
});

describe('extractThorDepositMemo', () => {
  it('does not treat slippage as memo', () => {
    const q = {
      includedSteps: [{ action: { slippage: 0.02 } }],
      transactionRequest: { data: '0x' },
    };
    assert.equal(extractThorDepositMemo(q), null);
  });

  it('extracts real memo string', () => {
    const memo = '=:ETH.USDT:0xabc:1000000';
    assert.equal(extractThorDepositMemo({ transactionRequest: { data: memo } }), memo);
    assert.equal(extractThorDepositMemo({ includedSteps: [{ toolDetails: { memo } }] }), memo);
  });
});

describe('normalizeLifiBridgeStatus', () => {
  it('DONE/REFUNDED is refunded not success', () => {
    const r = normalizeLifiBridgeStatus({ status: 'DONE', substatus: 'REFUNDED' });
    assert.equal(r.outcome, SWAP_OUTCOMES.REFUNDED);
    assert.equal(r.success, false);
  });

  it('DONE/PARTIAL is partial not success', () => {
    const r = normalizeLifiBridgeStatus({ status: 'DONE', substatus: 'PARTIAL' });
    assert.equal(r.outcome, SWAP_OUTCOMES.PARTIAL);
    assert.equal(r.success, false);
  });

  it('DONE/COMPLETED is completed', () => {
    const r = normalizeLifiBridgeStatus({
      status: 'DONE',
      substatus: 'COMPLETED',
      receiving: { token: { symbol: 'USDC' } },
    });
    assert.equal(r.outcome, SWAP_OUTCOMES.COMPLETED);
    assert.equal(r.success, true);
    assert.equal(r.assetHint, 'USDC');
  });

  it('DONE without substatus/receiving is unknown', () => {
    const r = normalizeLifiBridgeStatus({ status: 'DONE' });
    assert.equal(r.outcome, SWAP_OUTCOMES.UNKNOWN);
    assert.equal(r.success, false);
  });

  it('FAILED is not auto-refunded', () => {
    const r = normalizeLifiBridgeStatus({ status: 'FAILED', substatus: 'OUT_OF_GAS' });
    assert.equal(r.outcome, SWAP_OUTCOMES.FAILED);
    assert.equal(r.success, false);
  });
});
