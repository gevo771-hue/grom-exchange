import config from '../config/index.js';
import { query } from '../db/pool.js';
import {
  computeBankruptcyPrice,
  computeInsuranceContribution,
  computeLiqPrice,
  computeMarginRequired,
  computeUnrealisedPnL,
  toNum,
} from './risk.js';

export async function ensureFuturesMargin(tx, { userId, margin }) {
  const { rows } = await tx.query(
    `SELECT amount, locked
       FROM balances
      WHERE user_id=$1 AND asset='USDT' AND mode='live'
      FOR UPDATE`,
    [userId]
  );
  const available = Math.max(toNum(rows[0]?.amount) - toNum(rows[0]?.locked), 0);
  if (available < margin) {
    const err = new Error('insufficient_margin');
    err.status = 400;
    throw err;
  }
  await tx.query(
    `UPDATE balances
        SET amount = amount - $2, updated_at=NOW()
      WHERE user_id=$1 AND asset='USDT' AND mode='live'`,
    [userId, margin]
  );
}

export async function creditUsdt(tx, { userId, amount }) {
  if (amount <= 0) return;
  await tx.query(
    `INSERT INTO balances (user_id, asset, mode, amount, locked, updated_at)
     VALUES ($1, 'USDT', 'live', $2, 0, NOW())
     ON CONFLICT (user_id, asset, mode)
     DO UPDATE SET amount = balances.amount + EXCLUDED.amount, updated_at=NOW()`,
    [userId, amount]
  );
}

export async function openFuturesPosition(tx, { userId, input, fillPrice }) {
  const sideStr = input.side === 'buy' ? 'long' : 'short';
  const leverage = Math.min(Math.max(1, Number(input.leverage)), config.futures.maxLeverage);
  const margin = computeMarginRequired({ size: input.size, price: fillPrice, leverage });
  await ensureFuturesMargin(tx, { userId, margin });
  const liqPx = computeLiqPrice({
    side: sideStr,
    entry: fillPrice,
    leverage,
    mmr: config.futures.mmr.default,
  });
  const posRes = await tx.query(
    `INSERT INTO futures_positions
       (user_id, contract, side, leverage, size, entry_price, mark_price, margin_usdt, liq_price, status, margin_mode, unrealised_pnl, created_at, updated_at)
     VALUES
       ($1, $2, $3, $4, $5, $6, $6, $7, $8, 'open', 'cross', 0, NOW(), NOW())
    RETURNING id, user_id, contract, side, leverage, size, entry_price, mark_price, margin_usdt, liq_price, status, margin_mode, unrealised_pnl, funding_paid`,
    [userId, input.contract, sideStr, leverage, input.size, fillPrice, margin, liqPx]
  );
  return posRes.rows[0];
}

export async function closeFuturesPosition(tx, {
  position,
  markPrice,
  closeSize = null,
  reason = 'manual',
  liquidate = false,
}) {
  const size = toNum(position.size);
  const actualCloseSize = closeSize && closeSize > 0 ? Math.min(closeSize, size) : size;
  const realised = computeUnrealisedPnL({
    side: position.side,
    entry: position.entry_price,
    mark: markPrice,
    size: actualCloseSize,
  });
  const remainingSize = Math.max(size - actualCloseSize, 0);
  const isFullClose = remainingSize <= 0.0000001;
  const marginReleased = isFullClose
    ? toNum(position.margin_usdt)
    : toNum(position.margin_usdt) * (actualCloseSize / Math.max(size, actualCloseSize));
  const equity = marginReleased + realised;
  const insuranceContribution = liquidate
    ? computeInsuranceContribution({ equity, contributionPct: config.futures.insurance.contributionPct })
    : 0;
  const userCredit = Math.max(equity - insuranceContribution, 0);
  const insuranceDraw = Math.max(-equity, 0);

  if (isFullClose) {
    await tx.query(
      `UPDATE futures_positions
          SET size=0,
              status=$2,
              closed_at=NOW(),
              close_reason=$3,
              realised_pnl=COALESCE(realised_pnl,0) + $4,
              unrealised_pnl=0,
              margin_usdt=0,
              updated_at=NOW()
        WHERE id=$1`,
      [position.id, liquidate ? 'liquidated' : 'closed', reason, realised]
    );
  } else {
    await tx.query(
      `UPDATE futures_positions
          SET size=$2,
              margin_usdt=GREATEST(margin_usdt - $3, 0),
              realised_pnl=COALESCE(realised_pnl,0) + $4,
              updated_at=NOW()
        WHERE id=$1`,
      [position.id, remainingSize, marginReleased, realised]
    );
  }

  await creditUsdt(tx, { userId: position.user_id, amount: userCredit });
  if (insuranceContribution) {
    await tx.query(
      `UPDATE futures_insurance
          SET balance=balance + $2, updated_at=NOW()
        WHERE asset=$1`,
      ['USDT', insuranceContribution]
    );
  }
  if (insuranceDraw) {
    await tx.query(
      `UPDATE futures_insurance
          SET balance=balance - $2, updated_at=NOW()
        WHERE asset=$1`,
      ['USDT', insuranceDraw]
    );
  }

  if (liquidate) {
    const bankruptcy = computeBankruptcyPrice({
      side: position.side,
      entry: position.entry_price,
      leverage: position.leverage,
    });
    await tx.query(
      `INSERT INTO futures_liquidations
         (position_id, user_id, contract, side, size, mark_price, liq_price, bankruptcy_price, realised_pnl, insurance_contribution)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [position.id, position.user_id, position.contract, position.side, actualCloseSize, markPrice, position.liq_price, bankruptcy, realised, insuranceContribution]
    );
  }

  await tx.query(
    `INSERT INTO futures_position_events
       (position_id, user_id, event_type, trigger_price, size_delta, realised_pnl, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [position.id, position.user_id, liquidate ? 'liquidated' : reason, markPrice, actualCloseSize, realised, JSON.stringify({ full: isFullClose, equity, insurance_contribution: insuranceContribution, insurance_draw: insuranceDraw })]
  );

  return {
    position_id: position.id,
    closed_size: actualCloseSize,
    mark_price: markPrice,
    realised_pnl: realised,
    equity,
    insurance_contribution: insuranceContribution,
    full_close: isFullClose,
    close_reason: reason,
    status: liquidate ? 'liquidated' : (isFullClose ? 'closed' : 'open'),
  };
}
