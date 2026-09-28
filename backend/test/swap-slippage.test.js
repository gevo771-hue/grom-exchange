import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSlippageToFraction, slippageFractionToPercentLabel } from '../src/liquidity/swap-slippage.js';

describe('normalizeSlippageToFraction (settings store percent)', () => {
  it('maps saved 0.5 (0.5%) to fraction 0.005 — not 0.5/50%', () => {
    assert.equal(normalizeSlippageToFraction(0.5), 0.005);
    assert.equal(normalizeSlippageToFraction('0.5'), 0.005);
    assert.equal(normalizeSlippageToFraction('0,5'), 0.005);
    assert.equal(normalizeSlippageToFraction('0.5%'), 0.005);
  });

  it('maps 1 and 5 percent correctly', () => {
    assert.equal(normalizeSlippageToFraction(1), 0.01);
    assert.equal(normalizeSlippageToFraction('5'), 0.05);
  });

  it('rejects nonsense / uses fallback', () => {
    assert.equal(normalizeSlippageToFraction(-1), 0.005);
    assert.equal(normalizeSlippageToFraction('abc'), 0.005);
    assert.equal(normalizeSlippageToFraction(100), 0.005);
  });

  it('round-trips label', () => {
    assert.equal(slippageFractionToPercentLabel(0.005), '0.5');
    assert.equal(slippageFractionToPercentLabel(0.01), '1');
  });
});
