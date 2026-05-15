/**
 * Binary Options Engine
 * ---------------------
 * Responsibilities:
 *   1. Create rounds on a schedule per (asset, duration) pair.
 *   2. Transition rounds: open → locked (at close_at) → settled (at expiry_at).
 *   3. Accept positions while round is open, debit stake to bo_ledger.
 *   4. At expiry: fetch settlement price from price aggregator, mark winners/losers,
 *      credit payouts, write ledger rows, emit WebSocket events.
 *
 * Financial invariants (must never break):
 *   - sum(bo_ledger.amount per user) == user balance delta (append-only)
 *   - every bo_position transitions open → {won, lost, refunded}
 *   - on 'refunded' (missed settlement price / cancel) stake is fully returned
 */

import { randomUUID } from 'node:crypto';
import { query, withTx } from '../db/pool.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { metrics } from '../utils/metrics.js';

const PAYOUT = () => config.binary.payout;
const DURATIONS = () => config.binary.durations;

class BinaryEngine {
  constructor({ priceAggregator, wsBroadcaster }) {
    this.priceAggregator = priceAggregator;
    this.ws = wsBroadcaster;
    this.assets = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT'];
    this.timers = new Map();
  }

  async start() {
    logger.info('Binary engine starting');
    // Recover in-flight rounds from DB (after crash)
    await this._recoverInFlight();
    // Start round scheduler per (asset, duration)
    for (const asset of this.assets) {
      for (const duration of DURATIONS()) {
        await this._scheduleNextRound(asset, duration);
      }
    }
  }

  async stop() {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  async _recoverInFlight() {
    const { rows } = await query(
      `SELECT * FROM bo_rounds WHERE status IN ('open','locked') ORDER BY close_at ASC`
    );
    for (const r of rows) {
      const now = Date.now();
      const closeMs = new Date(r.close_at).getTime();
      const expiryMs = new Date(r.expiry_at).getTime();
      if (now >= expiryMs) {
        await this._settleRound(r.id);
      } else if (now >= closeMs && r.status === 'open') {
        await this._lockRound(r.id);
        this._scheduleTimer(`settle:${r.id}`, expiryMs - now, () => this._settleRound(r.id));
      } else {
        this._scheduleTimer(`lock:${r.id}`,   closeMs  - now, () => this._lockRound(r.id));
        this._scheduleTimer(`settle:${r.id}`, expiryMs - now, () => this._settleRound(r.id));
      }
    }
  }

  async _scheduleNextRound(asset, durationSec) {
    const now = Date.now();
    // Align start to the next even `durationSec` boundary — makes rounds predictable.
    const boundary = Math.ceil(now / (durationSec * 1000)) * durationSec * 1000;
    const openAt   = new Date(now);
    const closeAt  = new Date(boundary);
    const expiryAt = new Date(boundary + durationSec * 1000);

    const id = randomUUID();
    await query(
      `INSERT INTO bo_rounds (id, asset, duration_sec, open_at, close_at, expiry_at, payout_ratio)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, asset, durationSec, openAt, closeAt, expiryAt, PAYOUT()]
    );
    metrics.boRoundsCreated.inc({ asset, duration: String(durationSec) });

    this.ws?.broadcast('bo:round:new', { id, asset, duration_sec: durationSec, open_at: openAt, close_at: closeAt, expiry_at: expiryAt });

    this._scheduleTimer(`lock:${id}`,   closeAt.getTime()  - now, () => this._lockRound(id));
    this._scheduleTimer(`settle:${id}`, expiryAt.getTime() - now, () => this._settleRound(id));

    // Chain next round at close_at to keep continuous stream
    this._scheduleTimer(`next:${asset}:${durationSec}:${id}`, closeAt.getTime() - now, () =>
      this._scheduleNextRound(asset, durationSec)
    );
  }

  _scheduleTimer(key, delay, fn) {
    if (delay < 0) return fn();
    const t = setTimeout(() => { this.timers.delete(key); fn().catch(e => logger.error({ err: e, key }, 'timer fn failed')); }, delay);
    this.timers.set(key, t);
  }

  async _lockRound(roundId) {
    const price = await this._captureStrike(roundId);
    if (price == null) {
      logger.warn({ roundId }, 'strike unavailable (feeds warming up), retry lock in 1s');
      this._scheduleTimer(`lock:${roundId}`, 1000, () => this._lockRound(roundId));
      return;
    }
    await query(
      `UPDATE bo_rounds SET status='locked', strike_price=$2 WHERE id=$1 AND status='open'`,
      [roundId, price]
    );
    this.ws?.broadcast('bo:round:locked', { id: roundId, strike_price: price });
    logger.info({ roundId, price }, 'Round locked');
  }

  async _captureStrike(roundId) {
    const { rows } = await query(`SELECT asset FROM bo_rounds WHERE id=$1`, [roundId]);
    if (!rows[0]) throw new Error('Round not found');
    const price = await this.priceAggregator.getPrice(rows[0].asset);
    if (price == null) return null;
    return price;
  }

  async _settleRound(roundId) {
    await withTx(async (tx) => {
      const { rows } = await tx.query(
        `SELECT * FROM bo_rounds WHERE id=$1 FOR UPDATE`, [roundId]
      );
      const round = rows[0];
      if (!round || round.status === 'settled') return;

      let expiryPrice = null;
      try {
        expiryPrice = await this.priceAggregator.getPrice(round.asset);
      } catch (err) {
        logger.error({ err, roundId }, 'Failed to fetch expiry price');
      }

      if (expiryPrice == null || round.strike_price == null) {
        // Refund everyone — protects users from data outages
        await this._refundAll(tx, round);
        await tx.query(`UPDATE bo_rounds SET status='cancelled', settled_at=NOW() WHERE id=$1`, [roundId]);
        this.ws?.broadcast('bo:round:cancelled', { id: roundId });
        return;
      }

      await tx.query(
        `UPDATE bo_rounds SET expiry_price=$2, status='settling' WHERE id=$1`,
        [roundId, expiryPrice]
      );

      const direction = expiryPrice > round.strike_price ? 'up'
                      : expiryPrice < round.strike_price ? 'down'
                      : 'tie';

      // Positions
      const { rows: positions } = await tx.query(
        `SELECT * FROM bo_positions WHERE round_id=$1 AND status='open' FOR UPDATE`, [roundId]
      );

      for (const p of positions) {
        if (direction === 'tie') {
          // Refund on ties
          await this._refundPosition(tx, p);
        } else if (p.direction === direction) {
          const win = Number(p.stake) * Number(round.payout_ratio);
          await this._creditWin(tx, p, win);
        } else {
          await this._bookLoss(tx, p);
        }
      }

      await tx.query(
        `UPDATE bo_rounds SET status='settled', settled_at=NOW() WHERE id=$1`, [roundId]
      );
    });

    const { rows } = await query(`SELECT * FROM bo_rounds WHERE id=$1`, [roundId]);
    this.ws?.broadcast('bo:round:settled', rows[0]);
    logger.info({ roundId }, 'Round settled');
  }

  async _refundAll(tx, round) {
    const { rows: positions } = await tx.query(
      `SELECT * FROM bo_positions WHERE round_id=$1 AND status='open' FOR UPDATE`, [round.id]
    );
    for (const p of positions) await this._refundPosition(tx, p);
  }

  async _refundPosition(tx, p) {
    await tx.query(
      `UPDATE bo_positions SET status='refunded', settled_at=NOW(), payout=0 WHERE id=$1`, [p.id]
    );
    await this._ledgerInsert(tx, p, 'stake_refund', Number(p.stake));
  }

  async _creditWin(tx, p, winNet) {
    const totalCredit = Number(p.stake) + winNet; // stake back + profit
    await tx.query(
      `UPDATE bo_positions SET status='won', settled_at=NOW(), payout=$2 WHERE id=$1`,
      [p.id, winNet]
    );
    await this._ledgerInsert(tx, p, 'payout_win', totalCredit);
  }

  async _bookLoss(tx, p) {
    await tx.query(
      `UPDATE bo_positions SET status='lost', settled_at=NOW(), payout=$2 WHERE id=$1`,
      [p.id, -Number(p.stake)]
    );
    // stake was already locked on open; no further balance change here — record ledger for audit
    await this._ledgerInsert(tx, p, 'payout_loss', 0);
  }

  async _ledgerInsert(tx, position, kind, delta) {
    const { rows: bRows } = await tx.query(
      `SELECT amount, locked FROM balances WHERE user_id=$1 AND asset=$2 AND mode=$3 FOR UPDATE`,
      [position.user_id, position.asset, position.mode]
    );
    let amount = bRows[0] ? Number(bRows[0].amount)
      : (position.mode === 'demo' ? config.binary.demoBalance : 0);
    let locked = bRows[0] ? Number(bRows[0].locked) : 0;

    if (kind === 'stake_lock') {
      amount -= delta; locked += delta;
    } else if (kind === 'stake_refund' || kind === 'payout_win') {
      amount += delta; locked = Math.max(0, locked - Number(position.stake));
    } else if (kind === 'payout_loss') {
      locked = Math.max(0, locked - Number(position.stake));
    }

    await tx.query(
      `INSERT INTO balances (user_id, asset, mode, amount, locked, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW())
       ON CONFLICT (user_id, asset, mode) DO UPDATE
       SET amount = EXCLUDED.amount, locked = EXCLUDED.locked, updated_at = NOW()`,
      [position.user_id, position.asset, position.mode, amount, locked]
    );

    await tx.query(
      `INSERT INTO bo_ledger (user_id, position_id, kind, amount, asset, mode, balance_after)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [position.user_id, position.id, kind, delta, position.asset, position.mode, amount]
    );
  }

  /**
   * Open a position. Called by REST handler.
   * Returns the created position row or throws.
   */
  async placePosition({ userId, roundId, direction, stake, mode = 'demo', stakeAsset = 'USDT', clientIp = null }) {
    if (!['up', 'down'].includes(direction)) throw Object.assign(new Error('bad direction'), { status: 400 });
    if (!(stake > 0)) throw Object.assign(new Error('bad stake'), { status: 400 });
    if (stake < config.binary.minStake || stake > config.binary.maxStake) {
      throw Object.assign(new Error(`stake out of range [${config.binary.minStake}..${config.binary.maxStake}]`), { status: 400 });
    }

    return withTx(async (tx) => {
      const { rows } = await tx.query(
        `SELECT * FROM bo_rounds WHERE id=$1 FOR UPDATE`, [roundId]
      );
      const round = rows[0];
      if (!round) throw Object.assign(new Error('round not found'), { status: 404 });
      if (round.status !== 'open') throw Object.assign(new Error('round closed'), { status: 409 });
      if (Date.now() >= new Date(round.close_at).getTime()) {
        throw Object.assign(new Error('round locked'), { status: 409 });
      }

      // Check balance
      const { rows: bRows } = await tx.query(
        `SELECT amount FROM balances WHERE user_id=$1 AND asset=$2 AND mode=$3 FOR UPDATE`,
        [userId, stakeAsset, mode]
      );
      const avail = bRows[0] ? Number(bRows[0].amount) : (mode === 'demo' ? config.binary.demoBalance : 0);
      if (avail < stake) throw Object.assign(new Error('insufficient balance'), { status: 402 });

      // Create position
      const posId = randomUUID();
      await tx.query(
        `INSERT INTO bo_positions (id, round_id, user_id, direction, stake, asset, mode, client_ip)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [posId, roundId, userId, direction, stake, stakeAsset, mode, clientIp]
      );

      // Lock stake → ledger row
      await this._ledgerInsert(tx, {
        id: posId, user_id: userId, asset: stakeAsset, mode, stake
      }, 'stake_lock', stake);

      // Update round volume
      await tx.query(
        `UPDATE bo_rounds SET ${direction === 'up' ? 'total_up' : 'total_down'} = ${direction === 'up' ? 'total_up' : 'total_down'} + $2 WHERE id=$1`,
        [roundId, stake]
      );

      metrics.boPositionsOpened.inc({ asset: round.asset, direction, mode });
      this.ws?.broadcast('bo:position:new', { id: posId, round_id: roundId, user_id: userId, direction, stake, mode });
      return { id: posId, round_id: roundId, direction, stake, mode };
    });
  }
}

export default BinaryEngine;
