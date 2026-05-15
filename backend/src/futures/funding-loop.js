import config from '../config/index.js';
import { query, withTx } from '../db/pool.js';
import logger from '../utils/logger.js';
import { computeFundingPayment, computeFundingRate, toNum } from './risk.js';

export function currentFundingSlot(now = new Date(), intervalHours = 8) {
  const d = new Date(now);
  const hour = Math.floor(d.getUTCHours() / intervalHours) * intervalHours;
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

async function applyFundingForContract(contract, { priceAggregator, wsBroadcaster }) {
  const intervalHours = config.futures.funding.intervalHours;
  const slot = currentFundingSlot(new Date(), intervalHours);
  const recent = await query(
    `SELECT 1
       FROM futures_funding
      WHERE contract=$1 AND applied_at >= $2
      LIMIT 1`,
    [contract, slot]
  );
  if (recent.rowCount > 0) return null;

  const mark = toNum(await priceAggregator.getPrice(contract));
  const index = mark;
  if (!mark || !index) return null;
  const rate = computeFundingRate({ mark, index, cap: config.futures.funding.cap });

  const result = await withTx(async (tx) => {
    const funding = await tx.query(
      `INSERT INTO futures_funding (contract, rate, mark_price, index_price, interval_hours, applied_at)
       VALUES ($1,$2,$3,$4,$5,NOW())
       RETURNING id, contract, rate, mark_price, index_price, interval_hours, applied_at`,
      [contract, rate, mark, index, intervalHours]
    );
    const { rows: positions } = await tx.query(
      `SELECT id, user_id, side, size, mark_price
         FROM futures_positions
        WHERE contract=$1 AND status='open'
        FOR UPDATE`,
      [contract]
    );
    for (const pos of positions) {
      const payment = computeFundingPayment({ side: pos.side, size: pos.size, mark, rate });
      await tx.query(
        `UPDATE futures_positions
            SET margin_usdt = margin_usdt + $2,
                funding_paid = COALESCE(funding_paid,0) + $2,
                updated_at=NOW()
          WHERE id=$1`,
        [pos.id, payment]
      );
      if (payment !== 0) {
        await tx.query(
          `INSERT INTO balances (user_id, asset, mode, amount, locked, updated_at)
           VALUES ($1, 'USDT', 'live', $2, 0, NOW())
           ON CONFLICT (user_id, asset, mode)
           DO UPDATE SET amount = balances.amount + EXCLUDED.amount, updated_at=NOW()`,
          [pos.user_id, payment]
        );
      }
      await tx.query(
        `INSERT INTO futures_position_events (position_id, user_id, event_type, trigger_price, realised_pnl, metadata)
         VALUES ($1,$2,'funding',$3,$4,$5::jsonb)`,
        [pos.id, pos.user_id, mark, payment, JSON.stringify({ rate, contract })]
      );
    }
    return funding.rows[0];
  });

  wsBroadcaster?.broadcast(`funding.${contract}`, {
    event: 'futures_funding_applied',
    ...result,
  });
  return result;
}

export function startFuturesFundingLoop({ priceAggregator, wsBroadcaster = null, intervalMs = 60_000 } = {}) {
  let stopped = false;
  let running = false;

  async function tick() {
    if (running || stopped) return;
    running = true;
    try {
      const { rows } = await query(
        `SELECT DISTINCT contract
           FROM futures_positions
          WHERE status='open'`
      );
      for (const row of rows) {
        await applyFundingForContract(row.contract, { priceAggregator, wsBroadcaster });
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'futures funding loop failed');
    } finally {
      running = false;
    }
  }

  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  tick();

  return {
    tick,
    async stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}

export default startFuturesFundingLoop;
