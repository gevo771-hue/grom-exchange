import { withTx } from '../db/pool.js';
import { shouldTriggerTpSl } from './risk.js';
import { closeFuturesPosition } from './position-engine.js';

export async function closeTriggeredTpSl(position, { markPrice, reason, wsBroadcaster = null } = {}) {
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
    const freshReason = shouldTriggerTpSl({
      side: current.side,
      mark: markPrice,
      takeProfit: current.take_profit_price,
      stopLoss: current.stop_loss_price,
    });
    if (!freshReason || freshReason !== reason) return null;
    return closeFuturesPosition(tx, {
      position: current,
      markPrice,
      reason,
      liquidate: false,
    });
  });
  if (payload) {
    wsBroadcaster?.broadcast(`positions.user.${position.user_id}`, {
      event: reason === 'tp' ? 'futures_take_profit_closed' : 'futures_stop_loss_closed',
      ...payload,
    });
  }
  return payload;
}

export async function processTpSl(positions, { markPrice, wsBroadcaster = null } = {}) {
  const events = [];
  for (const position of positions) {
    const reason = shouldTriggerTpSl({
      side: position.side,
      mark: markPrice,
      takeProfit: position.take_profit_price,
      stopLoss: position.stop_loss_price,
    });
    if (reason) {
      const event = await closeTriggeredTpSl(position, { markPrice, reason, wsBroadcaster });
      if (event) events.push(event);
    }
  }
  return events;
}
