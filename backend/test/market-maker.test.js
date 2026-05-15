import test from 'node:test';
import assert from 'node:assert/strict';
import { computeQuotes, shouldRequote } from '../src/services/market-maker/strategy.js';
import { assessKillSwitch, checkRisk } from '../src/services/market-maker/risk.js';
import MarketMakerState from '../src/services/market-maker/state.js';
import BinanceRest from '../src/services/market-maker/binance-rest.js';
import { MarketMakerService } from '../src/services/market-maker/index.js';
import config from '../src/config/index.js';

test('market maker strategy computes layered bid/ask quotes', () => {
  const quotes = computeQuotes({
    midPrice: 100,
    pair: 'BTC/USDT',
    config: {
      spreadBps: 20,
      layerOffsetsBps: [10, 40],
      sizeBase: 0.01,
      layerSizeMultipliers: [1, 2.5],
    },
  });
  const bid1 = quotes.find((q) => q.side === 'buy' && q.layer === 1);
  const bid2 = quotes.find((q) => q.side === 'buy' && q.layer === 2);
  const ask1 = quotes.find((q) => q.side === 'sell' && q.layer === 1);
  const ask2 = quotes.find((q) => q.side === 'sell' && q.layer === 2);
  assert.equal(bid1.price, 99.85);
  assert.equal(bid2.price, 99.55);
  assert.equal(ask1.price, 100.15);
  assert.equal(ask2.price, 100.45);
  assert.equal(bid2.size, 0.025);
});

test('market maker shouldRequote respects drift threshold', () => {
  const currentQuotes = [{ side: 'buy', layer: 1, price: 100 }, { side: 'sell', layer: 1, price: 101 }];
  assert.equal(shouldRequote({
    currentQuotes,
    newQuotes: [{ side: 'buy', layer: 1, price: 100.02 }, { side: 'sell', layer: 1, price: 101.01 }],
    thresholdBps: 5,
  }), false);
  assert.equal(shouldRequote({
    currentQuotes,
    newQuotes: [{ side: 'buy', layer: 1, price: 100.2 }, { side: 'sell', layer: 1, price: 101 }],
    thresholdBps: 5,
  }), true);
});

test('market maker risk rejects position over limit and hedge outage', () => {
  assert.deepEqual(checkRisk({
    pair: 'BTC/USDT',
    side: 'buy',
    size: 0.2,
    currentPosition: { net_position: 0.4 },
    config: { maxPositionBase: 0.5 },
  }).ok, false);
  assert.equal(checkRisk({
    pair: 'BTC/USDT',
    side: 'buy',
    size: 0.01,
    currentPosition: { net_position: 0 },
    config: { maxPositionBase: 0.5 },
    hedgeHealth: false,
  }).reason, 'hedge_unavailable');
});

test('market maker kill switch triggers on total drawdown', () => {
  const result = assessKillSwitch({
    positions: [{ realised_pnl_usdt: -200 }, { unrealised_pnl_usdt: -350 }],
    config: { maxTotalDrawdownUsdt: 500 },
  });
  assert.equal(result.triggered, true);
});

test('market maker state loads and persists positions', async () => {
  const rows = {
    quotes: [{ id: 'q1', pair: 'BTC/USDT', side: 'buy', layer: 1, price: 99, size: 1, order_id: 'o1', status: 'placed' }],
    positions: [{ pair: 'BTC/USDT', net_position: '0.1', hedged_position: '0' }],
  };
  const calls = [];
  const state = new MarketMakerState({
    dbQuery: async (sql, params) => {
      calls.push({ sql, params });
      if (/FROM mm_quotes/.test(sql)) return { rows: rows.quotes };
      if (/FROM mm_positions/.test(sql) && !/INSERT/.test(sql)) return { rows: rows.positions };
      if (/INSERT INTO mm_positions/.test(sql)) return { rows: [{ pair: params[0], net_position: params[1], hedged_position: params[3] }] };
      return { rows: [] };
    },
  });
  await state.load();
  assert.equal(state.getPairQuotes('BTC/USDT').length, 1);
  const updated = await state.upsertPosition({ pair: 'BTC/USDT', netDelta: 0.2, hedgeDelta: -0.2, price: 100 });
  assert.equal(updated.net_position, 0.30000000000000004);
});

test('market maker Binance REST dry-run never calls network for hedge order', async () => {
  const rest = new BinanceRest({ dryRun: true });
  const result = await rest.placeMarketOrder({ symbol: 'BTCUSDT', side: 'BUY', quantity: 0.01 });
  assert.equal(result.status, 'DRY_RUN');
  assert.match(result.orderId, /^dry-/);
});

test('market maker onTick uses throttle instead of starving requote under continuous ticks', async () => {
  const originalRefresh = config.mm.refreshMs;
  config.mm.refreshMs = 20;
  const service = new MarketMakerService({
    wsBroadcaster: null,
    dbQuery: async () => ({ rows: [] }),
  });
  service.running = true;
  const calls = [];
  service.requote = async (tick) => {
    calls.push(tick);
  };

  for (let i = 0; i < 5; i += 1) {
    await service.onTick({ pair: 'BTC/USDT', bid: 100 + i, ask: 101 + i });
  }
  assert.equal(calls.length, 1);

  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.ok(calls.length >= 2);
  assert.equal(calls.at(-1).bid, 104);
  config.mm.refreshMs = originalRefresh;
});
