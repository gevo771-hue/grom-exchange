import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const GromSwapCore = require('../../frontend/public/grom-swap-core.js');

describe('BUG-1 xStocks USD impact guard', () => {
  it('blocks impact > 5% (Kyber AAPL-style $26 out of $100)', () => {
    const r = GromSwapCore.quoteUsdImpact({
      amountInUsd: 100,
      amountOutUsd: 26.81,
      maxImpact: 0.05,
    });
    assert.ok(r.impact > 0.7);
    assert.equal(r.blocked, true);
  });

  it('allows tight routes under 5%', () => {
    const r = GromSwapCore.quoteUsdImpact({
      amountInUsd: 100,
      amountOutUsd: 98.5,
      maxImpact: 0.05,
    });
    assert.ok(r.impact < 0.05);
    assert.equal(r.blocked, false);
  });

  it('scores by amountOutUsd when present (not raw token count)', () => {
    const thin = {
      toAmount: 124100000000000000n, // 0.1241 @ 18 dec — looks "ok" as tokens
      outDecimals: 18,
      amountOutUsd: 26.81,
    };
    const fair = {
      toAmount: 300000000000000000n, // 0.3 tokens
      outDecimals: 18,
      amountOutUsd: 99.0,
    };
    assert.ok(
      GromSwapCore.xstockQuoteValueScore(fair) > GromSwapCore.xstockQuoteValueScore(thin),
    );
  });
});
