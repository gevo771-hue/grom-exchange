import { withTx } from '../db/pool.js';
import { shouldLiquidate, toNum } from './risk.js';
import { closeFuturesPosition } from './position-engine.js';

export async function liquidatePosition(position, { markPrice, wsBroadcaster = null } = {}) {
  const payload = await withTx(async (tx) => {
    const { rows } = await tx.query(
      `SELECT *
         FROM futures_positions
        WHERE id=$1 AND status='open'
        FOR UPDATE`,
      [position.id]
    );
    const current = rows[0];
    if (!current) return null;
    if (!shouldLiquidate({ side: current.side, mark: markPrice, liq: current.liq_price })) return null;
    const result = await closeFuturesPosition(tx, {
      position: current,
      markPrice,
      reason: 'liquidation',
      liquidate: true,
    });
    await tx.query(
      `INSERT INTO notifications_outbox (user_id, channel, template, payload)
       VALUES ($1, 'email', 'futures_liquidated', $2::jsonb)`,
      [current.user_id, JSON.stringify({
        position_id: current.id,
        contract: current.contract,
        side: current.side,
        mark_price: markPrice,
        liq_price: current.liq_price,
        realised_pnl: result.realised_pnl,
      })]
    );
    return { ...result, contract: current.contract, side: current.side, user_id: current.user_id };
  });
  if (payload) {
    wsBroadcaster?.broadcast(`positions.user.${payload.user_id}`, {
      event: 'futures_position_liquidated',
      ...payload,
    });
    wsBroadcaster?.broadcast(`liquidations.${payload.contract}`, {
      event: 'futures_liquidation',
      ...payload,
      mark_price: toNum(payload.mark_price),
    });
  }
  return payload;
}

export async function processLiquidations(positions, { markPrice, wsBroadcaster = null } = {}) {
  const events = [];
  for (const position of positions) {
    if (shouldLiquidate({ side: position.side, mark: markPrice, liq: position.liq_price })) {
      const event = await liquidatePosition(position, { markPrice, wsBroadcaster });
      if (event) events.push(event);
    }
  }
  return events;
}
