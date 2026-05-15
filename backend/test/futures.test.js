import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeBankruptcyPrice,
  computeFundingPayment,
  computeFundingRate,
  computeInsuranceContribution,
  computeLiqPrice,
  computeMarginRequired,
  computeUnrealisedPnL,
  shouldLiquidate,
  shouldTriggerTpSl,
} from '../src/futures/risk.js';

test('computeUnrealisedPnL handles long and short', () => {
  assert.equal(computeUnrealisedPnL({ side: 'long', entry: 100, mark: 110, size: 2 }), 20);
  assert.equal(computeUnrealisedPnL({ side: 'short', entry: 100, mark: 90, size: 2 }), 20);
  assert.equal(computeUnrealisedPnL({ side: 'short', entry: 100, mark: 110, size: 2 }), -20);
});

test('computeLiqPrice and bankruptcy price produce expected direction', () => {
  assert.equal(Math.round(computeLiqPrice({ side: 'long', entry: 100000, leverage: 20, mmr: 0.005 })), 95500);
  assert.equal(Math.round(computeLiqPrice({ side: 'short', entry: 100000, leverage: 20, mmr: 0.005 })), 104500);
  assert.equal(computeBankruptcyPrice({ side: 'long', entry: 100000, leverage: 20 }), 95000);
  assert.equal(computeBankruptcyPrice({ side: 'short', entry: 100000, leverage: 20 }), 105000);
});

test('liquidation triggers on mark crossing liq price', () => {
  assert.equal(shouldLiquidate({ side: 'long', mark: 94999, liq: 95000 }), true);
  assert.equal(shouldLiquidate({ side: 'long', mark: 95001, liq: 95000 }), false);
  assert.equal(shouldLiquidate({ side: 'short', mark: 105001, liq: 105000 }), true);
  assert.equal(shouldLiquidate({ side: 'short', mark: 104999, liq: 105000 }), false);
});

test('TP/SL triggers by side', () => {
  assert.equal(shouldTriggerTpSl({ side: 'long', mark: 110, takeProfit: 109, stopLoss: 90 }), 'tp');
  assert.equal(shouldTriggerTpSl({ side: 'long', mark: 89, takeProfit: 109, stopLoss: 90 }), 'sl');
  assert.equal(shouldTriggerTpSl({ side: 'short', mark: 89, takeProfit: 90, stopLoss: 110 }), 'tp');
  assert.equal(shouldTriggerTpSl({ side: 'short', mark: 111, takeProfit: 90, stopLoss: 110 }), 'sl');
});

test('funding math clamps rate and signs long/short payments', () => {
  assert.equal(computeFundingRate({ mark: 110, index: 100, cap: 0.0075 }), 0.0075);
  assert.equal(computeFundingPayment({ side: 'long', size: 2, mark: 100, rate: 0.001 }), -0.2);
  assert.equal(computeFundingPayment({ side: 'short', size: 2, mark: 100, rate: 0.001 }), 0.2);
});

test('margin and insurance helpers compute expected values', () => {
  assert.equal(computeMarginRequired({ size: 2, price: 100, leverage: 10 }), 20);
  assert.equal(computeInsuranceContribution({ equity: 100, contributionPct: 0.05 }), 5);
  assert.equal(computeInsuranceContribution({ equity: -10, contributionPct: 0.05 }), 0);
});
