import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import config from '../config/index.js';
import idempotencyMiddleware from '../middleware/idempotency.js';
import { matchOrder } from './matcher.js';

const placeSpotSchema = z.object({
  pair: z.string().min(7).max(24),
  side: z.enum(['buy', 'sell']),
  type: z.enum(['market', 'limit', 'stop']).default('limit'),
  price: z.number().positive().optional(),
  triggerPrice: z.number().positive().optional(),
  amount: z.number().positive().max(1_000_000),
  clientOrderId: z.string().max(64).optional(),
});

const fillSpotSchema = z.object({
  filledAmount: z.number().positive().max(1_000_000),
  fillPrice: z.number().positive().optional(),
});

function toNum(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normaliseOrder(row) {
  if (!row) return row;
  return {
    ...row,
    price: toNum(row.price),
    amount: toNum(row.amount),
    filled: toNum(row.filled),
    reserved_amount: toNum(row.reserved_amount),
    trigger_price: toNum(row.trigger_price),
    fee_paid: toNum(row.fee_paid),
    avg_fill_price: toNum(row.avg_fill_price),
  };
}

export function buildOrderbookLevels(rows, depth = 25) {
  const bids = [];
  const asks = [];
  for (const row of rows || []) {
    const level = {
      price: toNum(row.price),
      size: toNum(row.size),
      orders: Number(row.orders || 0),
    };
    if (!level.price || !level.size) continue;
    if (row.side === 'buy') bids.push(level);
    if (row.side === 'sell') asks.push(level);
  }
  bids.sort((a, b) => b.price - a.price);
  asks.sort((a, b) => a.price - b.price);
  return {
    bids: bids.slice(0, depth),
    asks: asks.slice(0, depth),
  };
}

async function getOrderbookSnapshot(pair, depth = 25) {
  const { rows } = await query(
    `SELECT side,
            price,
            SUM(GREATEST(amount - filled, 0)) AS size,
            COUNT(*)::int AS orders
       FROM spot_orders
      WHERE pair=$1
        AND status IN ('open','partial')
        AND type='limit'
        AND price IS NOT NULL
        AND GREATEST(amount - filled, 0) > 0
      GROUP BY side, price`,
    [pair]
  );
  return {
    pair,
    depth,
    ...buildOrderbookLevels(rows, depth),
    ts: Date.now(),
  };
}

export async function broadcastOrderbookSnapshot(wsBroadcaster, pair, depth = 25) {
  if (!wsBroadcaster || !pair) return;
  const snapshot = await getOrderbookSnapshot(pair, depth);
  wsBroadcaster.broadcast(`orderbook.${pair}`, {
    event: 'orderbook_snapshot',
    ...snapshot,
  });
}

function normaliseTrade(row) {
  if (!row) return row;
  return {
    ...row,
    price: toNum(row.price),
    amount: toNum(row.amount),
    fee_taker: toNum(row.fee_taker),
    fee_maker: toNum(row.fee_maker),
    quote_volume: toNum(row.quote_volume),
  };
}

export function computeReservation({ side, amount, price, base, quote }) {
  const reservedAsset = side === 'buy' ? quote : base;
  const reservedAmount = side === 'buy' ? amount * price : amount;
  return { reservedAsset, reservedAmount };
}

async function releaseReservation(tx, { userId, asset, amount }) {
  if (!asset || amount <= 0) return;
  await tx.query(
    `UPDATE balances
     SET locked = GREATEST(locked - $3, 0), updated_at = NOW()
     WHERE user_id=$1 AND asset=$2 AND mode='live'`,
    [userId, asset, amount]
  );
}

async function creditAsset(tx, { userId, asset, amount }) {
  if (!asset || amount <= 0) return;
  await tx.query(
    `INSERT INTO balances (user_id, asset, mode, amount, locked, updated_at)
     VALUES ($1, $2, 'live', $3, 0, NOW())
     ON CONFLICT (user_id, asset, mode)
     DO UPDATE SET amount = balances.amount + EXCLUDED.amount, updated_at = NOW()`,
    [userId, asset, amount]
  );
}

async function settleImmediateOrder(tx, { userId, input, price }) {
  const [base, quote] = input.pair.split('/');
  const debitAsset = input.side === 'buy' ? quote : base;
  const debitAmount = input.side === 'buy' ? input.amount * price : input.amount;
  const creditAsset = input.side === 'buy' ? base : quote;
  const creditAmount = input.side === 'buy' ? input.amount : input.amount * price;

  const balanceRes = await tx.query(
    `SELECT amount, locked
     FROM balances
     WHERE user_id=$1 AND asset=$2 AND mode='live'
     FOR UPDATE`,
    [userId, debitAsset]
  );
  const balance = balanceRes.rows[0];
  if (!balance) {
    const err = new Error('asset balance not found');
    err.status = 404;
    throw err;
  }
  const available = Math.max(toNum(balance.amount) - toNum(balance.locked), 0);
  if (debitAmount > available) {
    const err = new Error('insufficient available balance');
    err.status = 400;
    throw err;
  }

  await tx.query(
    `UPDATE balances
     SET amount = amount - $3, updated_at = NOW()
     WHERE user_id=$1 AND asset=$2 AND mode='live'`,
    [userId, debitAsset, debitAmount]
  );
  await creditAsset(tx, { userId, asset: creditAsset, amount: creditAmount });

  const { rows } = await tx.query(
    `INSERT INTO spot_orders
       (user_id, pair, side, type, price, amount, filled, status, reserved_asset, reserved_amount, trigger_price, client_order_id, last_fill_at, updated_at)
     VALUES
       ($1, $2, $3, $4, $5, $6, $6, 'filled', NULL, 0, $7, $8, NOW(), NOW())
     RETURNING id, pair, side, type, price, amount, filled, status, reserved_asset, reserved_amount, trigger_price, client_order_id, created_at, updated_at, last_fill_at, cancelled_at`,
    [userId, input.pair, input.side, input.type, price, input.amount, input.triggerPrice || null, input.clientOrderId || null]
  );
  return rows[0];
}

async function placeOpenOrder(tx, { userId, input, price }) {
  const [base, quote] = input.pair.split('/');
  const { reservedAsset, reservedAmount } = computeReservation({
    side: input.side,
    amount: input.amount,
    price,
    base,
    quote,
  });
  const balanceRes = await tx.query(
    `SELECT amount, locked
     FROM balances
     WHERE user_id=$1 AND asset=$2 AND mode='live'
     FOR UPDATE`,
    [userId, reservedAsset]
  );
  const balance = balanceRes.rows[0];
  if (!balance) {
    const err = new Error('asset balance not found');
    err.status = 404;
    throw err;
  }
  const available = Math.max(toNum(balance.amount) - toNum(balance.locked), 0);
  if (reservedAmount > available) {
    const err = new Error('insufficient available balance');
    err.status = 400;
    throw err;
  }

  await tx.query(
    `UPDATE balances
     SET locked = locked + $3, updated_at = NOW()
     WHERE user_id=$1 AND asset=$2 AND mode='live'`,
    [userId, reservedAsset, reservedAmount]
  );

  const status = input.type === 'stop' ? 'pending_trigger' : 'open';
  const { rows } = await tx.query(
    `INSERT INTO spot_orders
       (user_id, pair, side, type, price, amount, filled, status, reserved_asset, reserved_amount, trigger_price, client_order_id, updated_at)
     VALUES
       ($1, $2, $3, $4, $5, $6, 0, $7, $8, $9, $10, $11, NOW())
     RETURNING id, pair, side, type, price, amount, filled, status, reserved_asset, reserved_amount, trigger_price, client_order_id, created_at, updated_at, last_fill_at, cancelled_at`,
    [userId, input.pair, input.side, input.type, price, input.amount, status, reservedAsset, reservedAmount, input.triggerPrice || null, input.clientOrderId || null]
  );
  return rows[0];
}

async function cancelRemaining(tx, order) {
  const releaseAmount = toNum(order.reserved_amount);
  await releaseReservation(tx, {
    userId: order.user_id,
    asset: order.reserved_asset,
    amount: releaseAmount,
  });
  const { rows } = await tx.query(
    `UPDATE spot_orders
        SET status='cancelled',
            reserved_amount=0,
            cancelled_at=NOW(),
            updated_at=NOW()
      WHERE id=$1
      RETURNING id, user_id, pair, side, type, price, amount, filled, status, reserved_asset, reserved_amount, trigger_price, client_order_id, fee_paid, avg_fill_price, created_at, updated_at, last_fill_at, cancelled_at`,
    [order.id]
  );
  return rows[0];
}

async function applyFill(tx, order, fillAmount, fillPrice) {
  const [base, quote] = String(order.pair).split('/');
  const orderAmount = toNum(order.amount);
  const currentFilled = toNum(order.filled);
  const price = fillPrice || toNum(order.price);
  const remaining = Math.max(orderAmount - currentFilled, 0);
  const actualFill = Math.min(fillAmount, remaining);
  if (actualFill <= 0) {
    const err = new Error('nothing left to fill');
    err.status = 400;
    throw err;
  }

  const isBuy = order.side === 'buy';
  const releaseAmount = isBuy ? actualFill * toNum(order.price) : actualFill;
  await releaseReservation(tx, {
    userId: order.user_id,
    asset: order.reserved_asset,
    amount: releaseAmount,
  });

  if (isBuy) {
    await tx.query(
      `UPDATE balances
       SET amount = amount - $3, updated_at = NOW()
       WHERE user_id=$1 AND asset=$2 AND mode='live'`,
      [order.user_id, quote, actualFill * price]
    );
    await creditAsset(tx, { userId: order.user_id, asset: base, amount: actualFill });
  } else {
    await tx.query(
      `UPDATE balances
       SET amount = amount - $3, updated_at = NOW()
       WHERE user_id=$1 AND asset=$2 AND mode='live'`,
      [order.user_id, base, actualFill]
    );
    await creditAsset(tx, { userId: order.user_id, asset: quote, amount: actualFill * price });
  }

  const nextFilled = currentFilled + actualFill;
  const remainingReserve = Math.max(toNum(order.reserved_amount) - releaseAmount, 0);
  const nextStatus = nextFilled >= orderAmount ? 'filled' : 'partial';
  const { rows } = await tx.query(
    `UPDATE spot_orders
     SET filled=$2,
         price=COALESCE($3, price),
         reserved_amount=$4,
         status=$5,
         last_fill_at=NOW(),
         updated_at=NOW()
     WHERE id=$1
     RETURNING id, user_id, pair, side, type, price, amount, filled, status, reserved_asset, reserved_amount, trigger_price, client_order_id, created_at, updated_at, last_fill_at, cancelled_at`,
    [order.id, nextFilled, fillPrice || null, remainingReserve, nextStatus]
  );
  return rows[0];
}

export function createSpotRouter({ requireAuth, priceAggregator, wsBroadcaster = null }) {
  const r = express.Router();
  const orderLimiter = rateLimit({
    windowMs: 60_000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.sub || req.ip,
  });

  r.get('/orders', requireAuth, async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
      const status = req.query.status ? String(req.query.status) : '';
      const params = [req.user.sub, limit];
      let sql = `SELECT id, user_id, pair, side, type, price, amount, filled, status, reserved_asset, reserved_amount, trigger_price, client_order_id, created_at, updated_at, last_fill_at, cancelled_at
                 FROM spot_orders
                 WHERE user_id=$1`;
      if (status) {
        params.push(status);
        sql += ` AND status=$3`;
      }
      sql += ` ORDER BY updated_at DESC, created_at DESC LIMIT $2`;
      const { rows } = await query(sql, params);
      res.json({ orders: rows.map(normaliseOrder) });
    } catch (err) { next(err); }
  });

  r.get('/orderbook', async (req, res, next) => {
    try {
      const pair = String(req.query.pair || 'BTC/USDT').toUpperCase();
      const depth = Math.min(Math.max(parseInt(req.query.depth || '25', 10), 1), 100);
      res.json(await getOrderbookSnapshot(pair, depth));
    } catch (err) { next(err); }
  });

  r.get('/trades', async (req, res, next) => {
    try {
      const pair = String(req.query.pair || 'BTC/USDT').toUpperCase();
      const limit = Math.min(Math.max(parseInt(req.query.limit || '100', 10), 1), 500);
      const { rows } = await query(
        `SELECT id, pair, price, amount, taker_order_id, maker_order_id, taker_user_id, maker_user_id, taker_side, fee_taker, fee_maker, quote_volume, created_at
           FROM spot_trades
          WHERE pair=$1
          ORDER BY created_at DESC
          LIMIT $2`,
        [pair, limit]
      );
      res.json({ trades: rows.map(normaliseTrade) });
    } catch (err) { next(err); }
  });

  r.get('/ticker', async (req, res, next) => {
    try {
      const pair = req.query.pair ? String(req.query.pair).toUpperCase() : null;
      const params = [];
      let where = `created_at >= NOW() - INTERVAL '24 hours'`;
      if (pair) {
        params.push(pair);
        where += ` AND pair=$1`;
      }
      const { rows } = await query(
        `WITH agg AS (
           SELECT pair,
                  SUM(quote_volume) AS volume_24h,
                  MAX(price) AS high_24h,
                  MIN(price) AS low_24h,
                  COUNT(*)::int AS trades_24h,
                  (ARRAY_AGG(price ORDER BY created_at DESC))[1] AS last_price,
                  (ARRAY_AGG(price ORDER BY created_at ASC))[1] AS open_price
             FROM spot_trades
            WHERE ${where}
            GROUP BY pair
         )
         SELECT pair, volume_24h, high_24h, low_24h, trades_24h, last_price, open_price,
                CASE WHEN open_price > 0 THEN ((last_price - open_price) / open_price) * 100 ELSE 0 END AS change_24h_pct
           FROM agg
          ORDER BY pair ASC`,
        params
      );
      const tickers = rows.map((row) => ({
        pair: row.pair,
        last_price: toNum(row.last_price),
        volume_24h: toNum(row.volume_24h),
        high_24h: toNum(row.high_24h),
        low_24h: toNum(row.low_24h),
        change_24h_pct: toNum(row.change_24h_pct),
        trades_24h: Number(row.trades_24h || 0),
      }));
      res.json(pair ? { ticker: tickers[0] || null } : { tickers });
    } catch (err) { next(err); }
  });

  r.post('/orders', requireAuth, orderLimiter, idempotencyMiddleware('spot_orders'), async (req, res, next) => {
    try {
      const input = placeSpotSchema.parse(req.body);
      const symbolRes = await query(
        `SELECT enabled, taker_fee_bps, maker_fee_bps, min_order_size FROM symbols WHERE pair=$1`,
        [input.pair]
      ).catch((err) => (err.code === '42P01' ? { rows: [] } : Promise.reject(err)));
      const symbol = symbolRes.rows[0];
      if (symbol?.enabled === false) return res.status(423).json({ error: 'symbol_disabled' });
      if (symbol?.min_order_size && input.amount < Number(symbol.min_order_size)) {
        return res.status(400).json({ error: 'min_order_size', minOrderSize: Number(symbol.min_order_size) });
      }
      const marketPrice = toNum(await priceAggregator.getPrice(input.pair));
      const marketLimit = input.side === 'buy'
        ? marketPrice * (1 + config.spot.matching.marketSlippageBps / 10_000)
        : marketPrice * (1 - config.spot.matching.marketSlippageBps / 10_000);
      const price = toNum(input.type === 'market' ? marketLimit : (input.price || marketPrice));
      if (!price || price <= 0) return res.status(400).json({ error: 'price unavailable' });

      const result = await withTx(async (tx) => {
        const placed = await placeOpenOrder(tx, { userId: req.user.sub, input, price });
        if (input.type === 'stop') return { order: placed, trades: [] };
        const matched = await matchOrder(tx, placed, {
          feeBps: {
            maker: symbol?.maker_fee_bps != null ? Number(symbol.maker_fee_bps) : config.spot.fees.maker,
            taker: symbol?.taker_fee_bps != null ? Number(symbol.taker_fee_bps) : config.spot.fees.taker,
          },
          maxLevelsPerOrder: config.spot.matching.maxLevelsPerOrder,
        });
        if (input.type === 'market' && matched.order.status !== 'filled') {
          matched.order = await cancelRemaining(tx, matched.order);
        }
        return matched;
      });
      const order = result.order;
      wsBroadcaster?.broadcast(`orders.user.${req.user.sub}`, {
        event: order.status === 'filled' ? 'spot_order_filled' : (order.status === 'partial' ? 'spot_order_partial' : 'spot_order_resting'),
        order: normaliseOrder(order),
      });
      wsBroadcaster?.broadcast(`balances.user.${req.user.sub}`, {
        event: result.trades.length ? 'spot_order_matched' : 'spot_order_reserved',
        pair: input.pair,
      });
      for (const trade of result.trades) {
        const payload = {
          event: 'spot_trade',
          trade: normaliseTrade(trade),
          taker: trade.taker_user_id,
          maker: trade.maker_user_id,
          price: toNum(trade.price),
          amount: toNum(trade.amount),
          ts: trade.created_at,
        };
        wsBroadcaster?.broadcast(`trades.${input.pair}`, payload);
        wsBroadcaster?.broadcast(`orders.user.${trade.maker_user_id}`, {
          event: 'spot_order_filled',
          order: normaliseOrder(trade.maker_order),
        });
        wsBroadcaster?.broadcast(`balances.user.${trade.maker_user_id}`, {
          event: 'spot_order_matched',
          pair: input.pair,
        });
      }
      await broadcastOrderbookSnapshot(wsBroadcaster, input.pair);

      res.status(201).json({ order: normaliseOrder(order), trades: result.trades.map(normaliseTrade) });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  });

  r.post('/orders/:id/cancel', requireAuth, async (req, res, next) => {
    try {
      const order = await withTx(async (tx) => {
        const { rows } = await tx.query(
          `SELECT *
           FROM spot_orders
           WHERE id=$1 AND user_id=$2
           FOR UPDATE`,
          [req.params.id, req.user.sub]
        );
        const current = rows[0];
        if (!current) {
          const err = new Error('order not found');
          err.status = 404;
          throw err;
        }
        if (!['open', 'partial', 'pending_trigger'].includes(current.status)) {
          const err = new Error('order cannot be cancelled');
          err.status = 400;
          throw err;
        }
        await releaseReservation(tx, {
          userId: req.user.sub,
          asset: current.reserved_asset,
          amount: toNum(current.reserved_amount),
        });
        const updated = await tx.query(
          `UPDATE spot_orders
           SET status='cancelled', reserved_amount=0, cancelled_at=NOW(), updated_at=NOW()
           WHERE id=$1
           RETURNING id, user_id, pair, side, type, price, amount, filled, status, reserved_asset, reserved_amount, trigger_price, client_order_id, created_at, updated_at, last_fill_at, cancelled_at`,
          [req.params.id]
        );
        return updated.rows[0];
      });
      wsBroadcaster?.broadcast(`orders.user.${req.user.sub}`, {
        event: 'spot_order_cancelled',
        order: normaliseOrder(order),
      });
      wsBroadcaster?.broadcast(`balances.user.${req.user.sub}`, {
        event: 'spot_order_reservation_released',
        pair: order.pair,
      });
      await broadcastOrderbookSnapshot(wsBroadcaster, order.pair);
      res.json({ order: normaliseOrder(order) });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  });

  r.post('/orders/:id/fills', requireAuth, async (req, res, next) => {
    try {
      const input = fillSpotSchema.parse(req.body);
      const order = await withTx(async (tx) => {
        const { rows } = await tx.query(
          `SELECT *
           FROM spot_orders
           WHERE id=$1 AND user_id=$2
           FOR UPDATE`,
          [req.params.id, req.user.sub]
        );
        const current = rows[0];
        if (!current) {
          const err = new Error('order not found');
          err.status = 404;
          throw err;
        }
        if (!['open', 'partial', 'pending_trigger'].includes(current.status)) {
          const err = new Error('order cannot be filled');
          err.status = 400;
          throw err;
        }
        return applyFill(tx, current, input.filledAmount, input.fillPrice || null);
      });
      wsBroadcaster?.broadcast(`orders.user.${req.user.sub}`, {
        event: 'spot_order_filled',
        order: normaliseOrder(order),
      });
      wsBroadcaster?.broadcast(`balances.user.${req.user.sub}`, {
        event: 'spot_fill_settled',
        pair: order.pair,
      });
      await broadcastOrderbookSnapshot(wsBroadcaster, order.pair);
      res.json({ order: normaliseOrder(order) });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  });

  return r;
}

export default createSpotRouter;
