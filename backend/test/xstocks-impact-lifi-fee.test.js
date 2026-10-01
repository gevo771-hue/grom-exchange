import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

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

  it('fails closed when a buy quote has no independent stock reference price', () => {
    const r = GromSwapCore.xstockBuyQuoteImpact({
      amountInUsd: 100,
      amountOutTokens: 0.0001,
      referencePriceUsd: 0,
    });
    assert.equal(r.blocked, true);
    assert.equal(r.reason, 'missing_fair_value');
  });

  it('blocks a buy route whose token output is far below reference value', () => {
    const r = GromSwapCore.xstockBuyQuoteImpact({
      amountInUsd: 100,
      amountOutTokens: 0.0001,
      referencePriceUsd: 40,
    });
    assert.ok(r.impact > 0.95);
    assert.equal(r.blocked, true);
  });

  it('allows a buy route close to independently referenced share value', () => {
    const r = GromSwapCore.xstockBuyQuoteImpact({
      amountInUsd: 100,
      amountOutTokens: 2.5,
      referencePriceUsd: 39.5,
      maxImpact: 0.05,
    });
    assert.ok(r.impact < 0.05);
    assert.equal(r.blocked, false);
  });

  it('values Solana raw output as adjusted shares using the active multiplier', () => {
    const r = GromSwapCore.xstockBuyQuoteImpact({
      amountInUsd: 100,
      amountOutTokens: 1.25,
      outputMultiplier: 2,
      requireMultiplier: true,
      referencePriceUsd: 39.5,
    });
    assert.equal(r.outputTokens, 2.5);
    assert.equal(r.rawOutputTokens, 1.25);
    assert.equal(r.blocked, false);
  });

  it('blocks Solana quote validation when the multiplier is unavailable', () => {
    const r = GromSwapCore.xstockBuyQuoteImpact({
      amountInUsd: 100,
      amountOutTokens: 2.5,
      outputMultiplier: null,
      requireMultiplier: true,
      referencePriceUsd: 39.5,
    });
    assert.equal(r.blocked, true);
    assert.equal(r.reason, 'missing_share_multiplier');
  });

  it('blocks overflowed reference values instead of accepting them as zero impact', () => {
    const r = GromSwapCore.xstockBuyQuoteImpact({
      amountInUsd: 100,
      amountOutTokens: Number.MAX_VALUE,
      referencePriceUsd: Number.MAX_VALUE,
    });
    assert.equal(r.blocked, true);
    assert.equal(r.reason, 'invalid_fair_value');
  });

  it('reuses the reference price when the stock dialog submits its final buy quote', () => {
    const html = readFileSync(new URL('../../frontend/public/index.html', import.meta.url), 'utf8');
    const call = html.match(/await window\.gwXstocksBuy\(\{([\s\S]*?)\n\s*\}\);/);
    assert.ok(call, 'stock buy confirmation call exists');
    assert.match(call[1], /refPrice:\s*px/);
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
