/**
 * Binary Options REST API.
 * Mounted at /api/binary.
 */
import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { combinedSignal, rsi, macd, bollinger } from './indicators.js';
import config from '../config/index.js';

export function createBinaryRouter({ engine, requireAuth, priceAggregator }) {
  const r = express.Router();

  // Heavy bet-rate limiter: protects the engine.
  const betLimiter = rateLimit({
    windowMs: 60_000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.sub || req.ip,
  });

  // GET /api/binary/rounds?asset=BTC/USDT
  r.get('/rounds', async (req, res, next) => {
    try {
      const asset = String(req.query.asset || 'BTC/USDT');
      const { rows } = await query(
        `SELECT id, asset, duration_sec, open_at, close_at, expiry_at, status, strike_price, total_up, total_down, payout_ratio
         FROM bo_rounds
         WHERE asset=$1 AND status IN ('open','locked')
         ORDER BY duration_sec, close_at`,
        [asset]
      );
      res.json({ rounds: rows, payout: config.binary.payout });
    } catch (err) { next(err); }
  });

  // POST /api/binary/positions
  const placeSchema = z.object({
    round_id:  z.string().uuid(),
    direction: z.enum(['up', 'down']),
    stake:     z.number().positive().max(config.binary.maxStake),
    mode:      z.enum(['live', 'demo']).default('demo'),
    asset:     z.string().default('USDT'),
  });
  r.post('/positions', requireAuth, betLimiter, async (req, res, next) => {
    try {
      const input = placeSchema.parse(req.body);
      const pos = await engine.placePosition({
        userId: req.user.sub,
        roundId: input.round_id,
        direction: input.direction,
        stake: input.stake,
        mode: input.mode,
        stakeAsset: input.asset,
        clientIp: req.ip,
      });
      res.status(201).json(pos);
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  });

  // GET /api/binary/positions — user's trade history
  r.get('/positions', requireAuth, async (req, res, next) => {
    try {
      const status = req.query.status ? String(req.query.status) : null;
      const limit  = Math.min(parseInt(req.query.limit || '50', 10), 500);
      const params = [req.user.sub];
      let sql = `SELECT p.*, r.asset, r.strike_price, r.expiry_price, r.close_at, r.expiry_at
                 FROM bo_positions p JOIN bo_rounds r ON r.id=p.round_id
                 WHERE p.user_id=$1`;
      if (status) { sql += ` AND p.status=$2`; params.push(status); }
      sql += ` ORDER BY p.placed_at DESC LIMIT ${limit}`;
      const { rows } = await query(sql, params);
      res.json({ positions: rows });
    } catch (err) { next(err); }
  });

  // GET /api/binary/analytics?asset=BTC/USDT
  r.get('/analytics', async (req, res, next) => {
    try {
      const asset = String(req.query.asset || 'BTC/USDT');
      const candles = await priceAggregator.getRecentCloses(asset, 120);
      if (!candles || candles.length < 30) return res.json({ insufficient: true });
      const sig = combinedSignal(candles);
      res.json({
        asset,
        samples: candles.length,
        price: candles[candles.length - 1],
        rsi: rsi(candles, 14),
        macd: macd(candles),
        bollinger: bollinger(candles),
        signal: sig,
      });
    } catch (err) { next(err); }
  });

  // GET /api/binary/ledger — append-only audit trail (user-scoped)
  r.get('/ledger', requireAuth, async (req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT id, position_id, kind, amount, asset, mode, balance_after, created_at
         FROM bo_ledger WHERE user_id=$1 ORDER BY created_at DESC LIMIT 500`,
        [req.user.sub]
      );
      res.json({ ledger: rows });
    } catch (err) { next(err); }
  });

  return r;
}

export default createBinaryRouter;
