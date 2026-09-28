import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmountToUnits, unitsToString, assertValidDecimals } from '../src/liquidity/swap-amount.js';

describe('parseAmountToUnits', () => {
  it('preserves full wei precision for 1.000000000000000001 ETH', () => {
    const u = parseAmountToUnits('1.000000000000000001', 18);
    assert.equal(u.toString(), '1000000000000000001');
  });

  it('handles 6 decimal USDC', () => {
    assert.equal(parseAmountToUnits('17.314167', 6).toString(), '17314167');
  });

  it('handles 0 decimals', () => {
    assert.equal(parseAmountToUnits('42', 0).toString(), '42');
  });

  it('handles 8 decimal WBTC', () => {
    assert.equal(parseAmountToUnits('0.00000001', 8).toString(), '1');
  });

  it('handles 9 decimal assets', () => {
    assert.equal(parseAmountToUnits('1.234567891', 9).toString(), '1234567891');
  });

  it('rejects excess precision by default', () => {
    assert.throws(() => parseAmountToUnits('1.1234567', 6), /too many fractional/);
  });

  it('can truncate excess precision when asked', () => {
    assert.equal(parseAmountToUnits('1.1234567', 6, { truncate: true }).toString(), '1123456');
  });

  it('rejects negative / zero / bad decimals', () => {
    assert.throws(() => parseAmountToUnits('-1', 18));
    assert.throws(() => parseAmountToUnits('0', 18));
    assert.throws(() => assertValidDecimals(6.5));
    assert.throws(() => assertValidDecimals(-1));
    assert.throws(() => assertValidDecimals(null));
  });

  it('round-trips via unitsToString', () => {
    const u = parseAmountToUnits('1.000000000000000001', 18);
    assert.equal(unitsToString(u, 18), '1.000000000000000001');
  });
});
