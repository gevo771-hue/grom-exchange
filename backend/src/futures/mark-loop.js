import { EventEmitter } from 'node:events';
import { query } from '../db/pool.js';
import logger from '../utils/logger.js';
import { computeUnrealisedPnL, toNum } from './risk.js';
import { processLiquidations } from './liquidation-engine.js';
import { processTpSl } from './tpsl-engine.js';

export function startFuturesMarkLoop({ priceAggregator, wsBroadcaster = null, intervalMs = 1_000 } = {}) {
  const events = new EventEmitter();
  let stopped = false;
  let running = false;

  async function tick() {
    if (running || stopped) return;
    running = true;
    try {
      const contracts = await query(
        `SELECT DISTINCT contract
           FROM futures_positions
          WHERE status='open'`
      );
      for (const { contract } of contracts.rows) {
        const markPx = toNum(await priceAggregator.getPrice(contract));
        if (!markPx) continue;
        const { rows: positions } = await query(
          `SELECT *
             FROM futures_positions
            WHERE contract=$1 AND status='open'`,
          [contract]
        );
        for (const position of positions) {
          const unrealised = computeUnrealisedPnL({
            side: position.side,
            entry: position.entry_price,
            mark: markPx,
            size: position.size,
          });
          await query(
            `UPDATE futures_positions
                SET mark_price=$2, unrealised_pnl=$3, updated_at=NOW()
              WHERE id=$1 AND status='open'`,
            [position.id, markPx, unrealised]
          );
          wsBroadcaster?.broadcast(`positions.user.${position.user_id}`, {
            event: 'futures_position_marked',
            position: { ...position, mark_price: markPx, unrealised_pnl: unrealised },
          });
        }
        const payload = { contract, mark_price: markPx, ts: Date.now() };
        wsBroadcaster?.broadcast(`mark_price.${contract}`, payload);
        events.emit('mark', payload);
        await processTpSl(positions, { markPrice: markPx, wsBroadcaster });
        await processLiquidations(positions, { markPrice: markPx, wsBroadcaster });
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'futures mark loop failed');
    } finally {
      running = false;
    }
  }

  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  tick();

  return {
    events,
    tick,
    async stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}

export default startFuturesMarkLoop;
