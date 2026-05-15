import express from 'express';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import config from '../config/index.js';
import idempotencyMiddleware from '../middleware/idempotency.js';
import { closeFuturesPosition, openFuturesPosition } from './position-engine.js';
import { computeFundingRate, riskSnapshot } from './risk.js';

const placeFuturesOrderSchema = z.object({
  contract: z.string().min(7).max(24),
  side: z.enum(['buy', 'sell']),
  type: z.enum(['market', 'limit', 'stop']).default('limit'),
  size: z.number().positive().max(1_000_000),
  price: z.number().positive().optional(),
  leverage: z.number().int().min(1).max(100),
  reduceOnly: z.boolean().optional(),
  postOnly: z.boolean().optional(),
});

function toNum(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function ensureDevFuturesSeed(userId, priceAggregator) {
  const existing = await query('SELECT 1 FROM futures_positions WHERE user_id=$1 LIMIT 1', [userId]);
  if (existing.rowCount > 0) return;
  const btc = toNum(await priceAggregator.getPrice('BTC/USDT')) || 104218.4;
  const eth = toNum(await priceAggregator.getPrice('ETH/USDT')) || 3684.15;
  await query(
    `INSERT INTO futures_positions
       (user_id, contract, side, leverage, size, entry_price, mark_price, margin_usdt, liq_price, status)
     VALUES
       ($1, 'BTC/USDT', 'long', 25, 0.45, $2, $2, 1861.42, $3, 'open'),
       ($1, 'ETH/USDT', 'short', 10, 1.8, $4, $4, 663.63, $5, 'open')`,
    [userId, btc, btc * 0.954, eth, eth * 1.099]
  );
}

export function createFuturesRouter({ requireAuth, priceAggregator, wsBroadcaster = null }) {
  const r = express.Router();

  r.get('/overview', requireAuth, async (req, res, next) => {
    try {
      await ensureDevFuturesSeed(req.user.sub, priceAggregator);
      const [positionsRes, ordersRes] = await Promise.all([
        query(
          `SELECT id, contract, side, leverage, size, entry_price, mark_price, margin_usdt, liq_price, status, margin_mode, unrealised_pnl, funding_paid, take_profit_price, stop_loss_price, realised_pnl, close_reason, created_at, updated_at
           FROM futures_positions
           WHERE user_id=$1
           ORDER BY created_at DESC`,
          [req.user.sub]
        ),
        query(
          `SELECT id, contract, side, type, price, size, leverage, status, reduce_only, post_only, created_at, updated_at
           FROM futures_orders
           WHERE user_id=$1
           ORDER BY created_at DESC
           LIMIT 50`,
          [req.user.sub]
        ),
      ]);
      res.json({ positions: positionsRes.rows, orders: ordersRes.rows });
    } catch (err) { next(err); }
  });

  r.post('/orders', requireAuth, idempotencyMiddleware('futures_orders'), async (req, res, next) => {
    try {
      const input = placeFuturesOrderSchema.parse(req.body);
      const symbolRes = await query(
        `SELECT enabled, max_leverage, min_order_size FROM symbols WHERE pair=$1`,
        [input.contract]
      ).catch((err) => (err.code === '42P01' ? { rows: [] } : Promise.reject(err)));
      const symbol = symbolRes.rows[0];
      if (symbol?.enabled === false) return res.status(423).json({ error: 'symbol_disabled' });
      if (symbol?.max_leverage && input.leverage > Number(symbol.max_leverage)) return res.status(400).json({ error: 'max_leverage_exceeded' });
      if (symbol?.min_order_size && input.size < Number(symbol.min_order_size)) return res.status(400).json({ error: 'min_order_size', minOrderSize: Number(symbol.min_order_size) });
      const markPx = toNum(await priceAggregator.getPrice(input.contract));
      const price  = toNum(input.price || markPx);
      // Market order → fill immediately and create/extend position; limit/stop stay open.
      const status = input.type === 'market' ? 'filled' : 'open';
      const fillPrice = input.type === 'market' ? markPx || price : price;
      let orderRes;
      let position = null;
      await withTx(async (tx) => {
        orderRes = await tx.query(
          `INSERT INTO futures_orders
             (user_id, contract, side, type, price, size, leverage, status, reduce_only, post_only, created_at, updated_at)
           VALUES
             ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
           RETURNING id, contract, side, type, price, size, leverage, status, reduce_only, post_only, created_at, updated_at`,
          [req.user.sub, input.contract, input.side, input.type, price, input.size, input.leverage, status, Boolean(input.reduceOnly), Boolean(input.postOnly)]
        );
        if (status === 'filled' && !input.reduceOnly && fillPrice > 0) {
          position = await openFuturesPosition(tx, { userId: req.user.sub, input, fillPrice });
          await tx.query(
            `INSERT INTO futures_position_events (position_id, user_id, event_type, trigger_price, size_delta, metadata)
             VALUES ($1, $2, 'open', $3, $4, jsonb_build_object('order_id', $5))`,
            [position.id, req.user.sub, fillPrice, input.size, orderRes.rows[0].id]
          );
        }
      });
      wsBroadcaster?.broadcast(`orders.user.${req.user.sub}`, {
        event: 'futures_order_created',
        order: orderRes.rows[0],
      });
      if (position) {
        wsBroadcaster?.broadcast(`positions.user.${req.user.sub}`, {
          event: 'futures_position_opened',
          position,
        });
      }
      res.status(201).json({ order: orderRes.rows[0], position });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  // ----- Set TP / SL on a position -----
  r.post('/positions/:id/tpsl', requireAuth, async (req, res, next) => {
    try {
      const tp = req.body?.take_profit_price != null ? Number(req.body.take_profit_price) : null;
      const sl = req.body?.stop_loss_price   != null ? Number(req.body.stop_loss_price)   : null;
      if (tp != null && !Number.isFinite(tp)) return res.status(400).json({ error: 'tp_invalid' });
      if (sl != null && !Number.isFinite(sl)) return res.status(400).json({ error: 'sl_invalid' });
      const { rows } = await query(
        `UPDATE futures_positions
            SET take_profit_price=$3, stop_loss_price=$4, updated_at=NOW()
          WHERE id=$1 AND user_id=$2 AND status='open'
        RETURNING id, contract, take_profit_price, stop_loss_price`,
        [req.params.id, req.user.sub, tp, sl]
      );
      if (!rows.length) return res.status(404).json({ error: 'position_not_found' });
      await query(
        `INSERT INTO futures_position_events (position_id, user_id, event_type, metadata)
         VALUES ($1, $2, 'tpsl_update', jsonb_build_object('tp', $3, 'sl', $4))`,
        [req.params.id, req.user.sub, tp, sl]
      );
      wsBroadcaster?.broadcast(`positions.user.${req.user.sub}`, {
        event: 'futures_position_tpsl_updated',
        position: rows[0],
      });
      res.json({ position: rows[0] });
    } catch (err) { next(err); }
  });

  // ----- Close position at market -----
  r.post('/positions/:id/close', requireAuth, async (req, res, next) => {
    try {
      const sizeOpt = req.body?.size != null ? Number(req.body.size) : null;
      const payload = await withTx(async (tx) => {
        const { rows: posRows } = await tx.query(
          `SELECT *
             FROM futures_positions
            WHERE id=$1 AND user_id=$2 AND status='open'
            FOR UPDATE`,
          [req.params.id, req.user.sub]
        );
        if (!posRows.length) return null;
        const pos = posRows[0];
        const closeSize = sizeOpt && sizeOpt > 0 ? Math.min(sizeOpt, Number(pos.size)) : Number(pos.size);
        const markPx = toNum(await priceAggregator.getPrice(pos.contract)) || Number(pos.entry_price);
        return closeFuturesPosition(tx, {
          position: pos,
          markPrice: markPx,
          closeSize,
          reason: closeSize < Number(pos.size) ? 'partial_close' : 'manual',
        });
      });
      if (!payload) return res.status(404).json({ error: 'position_not_found' });
      wsBroadcaster?.broadcast(`positions.user.${req.user.sub}`, {
        event: payload.full_close ? 'futures_position_closed' : 'futures_position_partially_closed',
        ...payload,
      });
      res.json(payload);
    } catch (err) { next(err); }
  });

  r.get('/positions/:id/risk', requireAuth, async (req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT *
           FROM futures_positions
          WHERE id=$1 AND user_id=$2`,
        [req.params.id, req.user.sub]
      );
      if (!rows.length) return res.status(404).json({ error: 'position_not_found' });
      const position = rows[0];
      const mark = toNum(await priceAggregator.getPrice(position.contract)) || toNum(position.mark_price);
      const expectedRate = computeFundingRate({ mark, index: mark, cap: config.futures.funding.cap });
      res.json({ risk: riskSnapshot({ ...position, mark_price: mark }, { mmr: config.futures.mmr.default, expectedFundingRate: expectedRate }) });
    } catch (err) { next(err); }
  });

  r.get('/funding', async (req, res, next) => {
    try {
      const contract = req.query.contract ? String(req.query.contract) : null;
      const params = [];
      let where = '';
      if (contract) {
        params.push(contract);
        where = 'WHERE contract=$1';
      }
      const { rows } = await query(
        `SELECT id, contract, rate, mark_price, index_price, interval_hours, applied_at
           FROM futures_funding
          ${where}
          ORDER BY applied_at DESC
          LIMIT 50`,
        params
      );
      res.json({ funding: rows });
    } catch (err) { next(err); }
  });

  r.get('/liquidations', async (req, res, next) => {
    try {
      const contract = req.query.contract ? String(req.query.contract) : null;
      const params = [];
      let where = '';
      if (contract) {
        params.push(contract);
        where = 'WHERE contract=$1';
      }
      const { rows } = await query(
        `SELECT id, position_id, user_id, contract, side, size, mark_price, liq_price, bankruptcy_price, realised_pnl, insurance_contribution, created_at
           FROM futures_liquidations
          ${where}
          ORDER BY created_at DESC
          LIMIT 100`,
        params
      );
      res.json({ liquidations: rows });
    } catch (err) { next(err); }
  });

  return r;
}

export default createFuturesRouter;
