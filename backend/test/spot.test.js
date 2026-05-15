import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderbookLevels, computeReservation } from '../src/spot/routes.js';
import { matchOrder } from '../src/spot/matcher.js';
import { verifyWebhookSignature } from '../src/wallet/routes.js';
import crypto from 'node:crypto';

function makeOrder(overrides) {
  return {
    id: overrides.id,
    user_id: overrides.user_id || `${overrides.id}-user`,
    pair: 'BTC/USDT',
    side: overrides.side,
    type: overrides.type || 'limit',
    price: overrides.price,
    amount: overrides.amount,
    filled: overrides.filled || 0,
    status: overrides.status || 'open',
    reserved_asset: overrides.side === 'buy' ? 'USDT' : 'BTC',
    reserved_amount: overrides.side === 'buy' ? overrides.amount * overrides.price : overrides.amount,
    fee_paid: 0,
    avg_fill_price: null,
    created_at: overrides.created_at || new Date().toISOString(),
  };
}

function fakeTx({ makers = [] } = {}) {
  const orders = new Map(makers.map((order) => [order.id, { ...order }]));
  const trades = [];
  return {
    orders,
    trades,
    async query(sql, params) {
      if (/SELECT \*/.test(sql) && /FROM spot_orders/.test(sql)) {
        return { rows: makers.map((order) => orders.get(order.id)).filter(Boolean) };
      }
      if (/INSERT INTO spot_trades/.test(sql)) {
        const row = {
          id: `t${trades.length + 1}`,
          pair: params[0],
          price: params[1],
          amount: params[2],
          taker_order_id: params[3],
          maker_order_id: params[4],
          taker_user_id: params[5],
          maker_user_id: params[6],
          taker_side: params[7],
          fee_taker: params[8],
          fee_maker: params[9],
          quote_volume: params[10],
          created_at: new Date().toISOString(),
        };
        trades.push(row);
        return { rows: [row] };
      }
      if (/UPDATE spot_orders/.test(sql)) {
        const current = orders.get(params[0]) || {};
        const updated = {
          ...current,
          id: params[0],
          filled: params[1],
          status: params[2],
          reserved_amount: params[3],
          fee_paid: Number(current.fee_paid || 0) + Number(params[4] || 0),
          avg_fill_price: params[5],
        };
        orders.set(params[0], updated);
        return { rows: [updated] };
      }
      return { rows: [] };
    },
  };
}

test('computeReservation reserves quote notional for buy orders', () => {
  const result = computeReservation({
    side: 'buy',
    amount: 0.5,
    price: 1000,
    base: 'ETH',
    quote: 'USDT',
  });
  assert.deepEqual(result, { reservedAsset: 'USDT', reservedAmount: 500 });
});

test('computeReservation reserves base size for sell orders', () => {
  const result = computeReservation({
    side: 'sell',
    amount: 2,
    price: 200,
    base: 'SOL',
    quote: 'USDT',
  });
  assert.deepEqual(result, { reservedAsset: 'SOL', reservedAmount: 2 });
});

test('buildOrderbookLevels sorts bids descending and asks ascending', () => {
  const result = buildOrderbookLevels([
    { side: 'buy', price: '100', size: '1.2', orders: 2 },
    { side: 'buy', price: '101', size: '0.4', orders: 1 },
    { side: 'sell', price: '103', size: '0.8', orders: 3 },
    { side: 'sell', price: '102', size: '0.5', orders: 1 },
  ]);

  assert.deepEqual(result.bids.map((level) => level.price), [101, 100]);
  assert.deepEqual(result.asks.map((level) => level.price), [102, 103]);
  assert.equal(result.bids[0].size, 0.4);
  assert.equal(result.asks[0].orders, 1);
});

test('verifyWebhookSignature validates matching hmac signature', () => {
  const body = JSON.stringify({ transferId: 'abc', status: 'completed' });
  const secret = 'super-secret';
  const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(verifyWebhookSignature(secret, body, sig), true);
  assert.equal(verifyWebhookSignature(secret, body, 'bad-signature'), false);
});

test('matchOrder: empty book leaves order resting', async () => {
  const taker = makeOrder({ id: 'buy1', user_id: 'u1', side: 'buy', price: 100, amount: 1 });
  const tx = fakeTx({ makers: [] });
  tx.orders.set(taker.id, taker);
  const result = await matchOrder(tx, taker, { feeBps: { maker: 5, taker: 10 } });
  assert.equal(result.trades.length, 0);
  assert.equal(result.status, 'open');
});

test('matchOrder: limit buy crosses one ask and fills', async () => {
  const taker = makeOrder({ id: 'buy1', user_id: 'u1', side: 'buy', price: 101, amount: 1 });
  const maker = makeOrder({ id: 'ask1', user_id: 'u2', side: 'sell', price: 100, amount: 1 });
  const tx = fakeTx({ makers: [maker] });
  tx.orders.set(taker.id, taker);
  const result = await matchOrder(tx, taker, { feeBps: { maker: 5, taker: 10 } });
  assert.equal(result.trades.length, 1);
  assert.equal(result.status, 'filled');
  assert.equal(Number(result.trades[0].price), 100);
});

test('matchOrder: limit buy consumes multiple asks and leaves partial taker', async () => {
  const taker = makeOrder({ id: 'buy1', user_id: 'u1', side: 'buy', price: 105, amount: 3 });
  const makers = [
    makeOrder({ id: 'ask1', user_id: 'u2', side: 'sell', price: 100, amount: 1 }),
    makeOrder({ id: 'ask2', user_id: 'u3', side: 'sell', price: 101, amount: 1 }),
  ];
  const tx = fakeTx({ makers });
  tx.orders.set(taker.id, taker);
  const result = await matchOrder(tx, taker, { feeBps: { maker: 5, taker: 10 } });
  assert.equal(result.trades.length, 2);
  assert.equal(result.status, 'partial');
  assert.equal(Number(result.order.filled), 2);
});

test('matchOrder: market sell eats five levels', async () => {
  const taker = makeOrder({ id: 'sell1', user_id: 'u1', side: 'sell', type: 'market', price: 90, amount: 5 });
  const makers = [101, 100, 99, 98, 97].map((price, i) => makeOrder({
    id: `bid${i}`,
    user_id: `u${i + 2}`,
    side: 'buy',
    price,
    amount: 1,
  }));
  const tx = fakeTx({ makers });
  tx.orders.set(taker.id, taker);
  const result = await matchOrder(tx, taker, { feeBps: { maker: 5, taker: 10 }, maxLevelsPerOrder: 5 });
  assert.equal(result.trades.length, 5);
  assert.equal(result.status, 'filled');
});

test('matchOrder: price-time priority fills older maker first when order is selected first', async () => {
  const taker = makeOrder({ id: 'buy1', user_id: 'u1', side: 'buy', price: 100, amount: 1 });
  const older = makeOrder({ id: 'ask-old', user_id: 'u2', side: 'sell', price: 100, amount: 1, created_at: '2026-01-01T00:00:00Z' });
  const newer = makeOrder({ id: 'ask-new', user_id: 'u3', side: 'sell', price: 100, amount: 1, created_at: '2026-01-02T00:00:00Z' });
  const tx = fakeTx({ makers: [older, newer] });
  tx.orders.set(taker.id, taker);
  const result = await matchOrder(tx, taker, { feeBps: { maker: 5, taker: 10 } });
  assert.equal(result.trades[0].maker_order_id, 'ask-old');
});

test('matchOrder: maker and taker fees are calculated in bps', async () => {
  const taker = makeOrder({ id: 'buy1', user_id: 'u1', side: 'buy', price: 100, amount: 2 });
  const maker = makeOrder({ id: 'ask1', user_id: 'u2', side: 'sell', price: 100, amount: 2 });
  const tx = fakeTx({ makers: [maker] });
  tx.orders.set(taker.id, taker);
  const result = await matchOrder(tx, taker, { feeBps: { maker: 5, taker: 10 } });
  assert.equal(Number(result.trades[0].fee_taker), 0.2);
  assert.equal(Number(result.trades[0].fee_maker), 0.001);
});
