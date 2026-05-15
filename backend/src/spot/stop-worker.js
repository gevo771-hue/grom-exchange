import config from '../config/index.js';
import { query, withTx } from '../db/pool.js';
import logger from '../utils/logger.js';
import { matchOrder } from './matcher.js';
import { broadcastOrderbookSnapshot } from './routes.js';

function toNum(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function triggerOne(order, { priceAggregator, wsBroadcaster }) {
  const markPx = toNum(await priceAggregator.getPrice(order.pair));
  const triggerPx = toNum(order.trigger_price);
  if (!markPx || !triggerPx) return null;
  const shouldTrigger = order.side === 'buy' ? markPx >= triggerPx : markPx <= triggerPx;
  if (!shouldTrigger) return null;

  const result = await withTx(async (tx) => {
    const { rows } = await tx.query(
      `UPDATE spot_orders
          SET status='open', updated_at=NOW()
        WHERE id=$1 AND status='pending_trigger'
        RETURNING id, user_id, pair, side, type, price, amount, filled, status, reserved_asset, reserved_amount, trigger_price, client_order_id, fee_paid, avg_fill_price, created_at, updated_at, last_fill_at, cancelled_at`,
      [order.id]
    );
    if (!rows[0]) return null;
    const matched = await matchOrder(tx, rows[0], {
      feeBps: config.spot.fees,
      maxLevelsPerOrder: config.spot.matching.maxLevelsPerOrder,
    });
    return matched;
  });

  if (!result) return null;
  wsBroadcaster?.broadcast(`orders.user.${order.user_id}`, {
    event: 'spot_stop_triggered',
    order: result.order,
  });
  for (const trade of result.trades) {
    wsBroadcaster?.broadcast(`trades.${order.pair}`, {
      event: 'spot_trade',
      trade,
      taker: trade.taker_user_id,
      maker: trade.maker_user_id,
      price: toNum(trade.price),
      amount: toNum(trade.amount),
      ts: trade.created_at,
    });
    wsBroadcaster?.broadcast(`balances.user.${trade.taker_user_id}`, { event: 'spot_order_matched', pair: order.pair });
    wsBroadcaster?.broadcast(`balances.user.${trade.maker_user_id}`, { event: 'spot_order_matched', pair: order.pair });
    wsBroadcaster?.broadcast(`orders.user.${trade.maker_user_id}`, { event: 'spot_order_filled', order: trade.maker_order });
  }
  await broadcastOrderbookSnapshot(wsBroadcaster, order.pair);
  return result;
}

export function startSpotStopWorker({ priceAggregator, wsBroadcaster, intervalMs = 2_000 } = {}) {
  let stopped = false;
  let running = false;

  async function tick() {
    if (running || stopped) return;
    running = true;
    try {
      const { rows } = await query(
        `SELECT id, user_id, pair, side, type, price, amount, filled, status, reserved_asset, reserved_amount, trigger_price, client_order_id, fee_paid, avg_fill_price, created_at, updated_at, last_fill_at, cancelled_at
           FROM spot_orders
          WHERE status='pending_trigger'
          ORDER BY updated_at ASC
          LIMIT 100`
      );
      for (const order of rows) {
        await triggerOne(order, { priceAggregator, wsBroadcaster });
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'spot stop worker failed');
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

export default startSpotStopWorker;
