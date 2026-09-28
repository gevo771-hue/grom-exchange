/**
 * RR4 synthetic literals retired — real Express route coverage lives in
 * rr5-jup-odos-route-fee.test.js (platformFeeBps, per-mint feeAccount, Odos).
 * Keep a tiny smoke that fee bps default remains 20 (0.002).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { jupFeeBpsFromConfig } from '../src/wallet/jup-fee.js';

describe('RR4→RR5 fee bps contract', () => {
  it('fee mode default platform fee is 20 bps (0.002)', () => {
    assert.equal(jupFeeBpsFromConfig({ liquidity: { jupiterFeeMode: 'fee' } }), 20);
    assert.equal(jupFeeBpsFromConfig({ liquidity: { jupiterFeeMode: 'fee', feeBps: 20 } }), 20);
    assert.equal(jupFeeBpsFromConfig({ liquidity: { jupiterFeeMode: 'free' } }), 0);
    assert.equal(jupFeeBpsFromConfig({ liquidity: {} }), 0);
    assert.equal(20 / 10000, 0.002);
  });
});
