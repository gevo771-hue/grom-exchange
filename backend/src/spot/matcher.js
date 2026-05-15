function toNum(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function remaining(order) {
  return Math.max(toNum(order.amount) - toNum(order.filled), 0);
}

function feeFor({ side, amount, price, bps }) {
  if (side === 'buy') return amount * price * bps / 10_000;
  return amount * bps / 10_000;
}

function nextAvgPrice(order, fillAmount, fillPrice) {
  const oldFilled = toNum(order.filled);
  const oldAvg = toNum(order.avg_fill_price);
  const nextFilled = oldFilled + fillAmount;
  if (nextFilled <= 0) return null;
  return ((oldAvg * oldFilled) + (fillPrice * fillAmount)) / nextFilled;
}

async function releaseLocked(tx, { userId, asset, amount }) {
  if (!asset || amount <= 0) return;
  await tx.query(
    `UPDATE balances
        SET locked = GREATEST(locked - $3, 0), updated_at=NOW()
      WHERE user_id=$1 AND asset=$2 AND mode='live'`,
    [userId, asset, amount]
  );
}

async function debit(tx, { userId, asset, amount }) {
  if (!asset || amount <= 0) return;
  await tx.query(
    `UPDATE balances
        SET amount = amount - $3, updated_at=NOW()
      WHERE user_id=$1 AND asset=$2 AND mode='live'`,
    [userId, asset, amount]
  );
}

async function credit(tx, { userId, asset, amount }) {
  if (!asset || amount <= 0) return;
  await tx.query(
    `INSERT INTO balances (user_id, asset, mode, amount, locked, updated_at)
     VALUES ($1, $2, 'live', $3, 0, NOW())
     ON CONFLICT (user_id, asset, mode)
     DO UPDATE SET amount = balances.amount + EXCLUDED.amount, updated_at=NOW()`,
    [userId, asset, amount]
  );
}

function crossingClause(order) {
  if (order.type === 'market') return '';
  if (order.side === 'buy') return 'AND price <= $2';
  return 'AND price >= $2';
}

function makerOrderBy(order) {
  return order.side === 'buy' ? 'price ASC, created_at ASC' : 'price DESC, created_at ASC';
}

export async function selectMatchingMakers(tx, takerOrder, maxLevels = 50) {
  const oppositeSide = takerOrder.side === 'buy' ? 'sell' : 'buy';
  const price = toNum(takerOrder.price);
  const params = [takerOrder.pair];
  if (takerOrder.type !== 'market') params.push(price);
  params.push(maxLevels);
  const limitParam = params.length;
  const { rows } = await tx.query(
    `SELECT *
       FROM spot_orders
      WHERE pair=$1
        AND side='${oppositeSide}'
        AND status IN ('open','partial')
        AND type='limit'
        AND GREATEST(amount - filled, 0) > 0
        ${crossingClause(takerOrder)}
      ORDER BY ${makerOrderBy(takerOrder)}
      LIMIT $${limitParam}
      FOR UPDATE`,
    params
  );
  return rows;
}

async function settleTrade(tx, { taker, maker, amount, price, feeBps }) {
  const [base, quote] = String(taker.pair).split('/');
  const takerSide = taker.side;
  const makerSide = maker.side;
  const quoteVolume = amount * price;
  const takerFee = feeFor({ side: takerSide, amount, price, bps: feeBps.taker });
  const makerFee = feeFor({ side: makerSide, amount, price, bps: feeBps.maker });

  const takerRelease = takerSide === 'buy' ? amount * toNum(taker.price || price) : amount;
  const makerRelease = makerSide === 'buy' ? amount * toNum(maker.price || price) : amount;
  await releaseLocked(tx, { userId: taker.user_id, asset: taker.reserved_asset, amount: takerRelease });
  await releaseLocked(tx, { userId: maker.user_id, asset: maker.reserved_asset, amount: makerRelease });

  if (takerSide === 'buy') {
    await debit(tx, { userId: taker.user_id, asset: quote, amount: quoteVolume + takerFee });
    await credit(tx, { userId: taker.user_id, asset: base, amount });
    await debit(tx, { userId: maker.user_id, asset: base, amount: amount + makerFee });
    await credit(tx, { userId: maker.user_id, asset: quote, amount: quoteVolume });
  } else {
    await debit(tx, { userId: taker.user_id, asset: base, amount: amount + takerFee });
    await credit(tx, { userId: taker.user_id, asset: quote, amount: quoteVolume });
    await debit(tx, { userId: maker.user_id, asset: quote, amount: quoteVolume + makerFee });
    await credit(tx, { userId: maker.user_id, asset: base, amount });
  }

  const trade = await tx.query(
    `INSERT INTO spot_trades
       (pair, price, amount, taker_order_id, maker_order_id, taker_user_id, maker_user_id, taker_side, fee_taker, fee_maker, quote_volume)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id, pair, price, amount, taker_order_id, maker_order_id, taker_user_id, maker_user_id, taker_side, fee_taker, fee_maker, quote_volume, created_at`,
    [taker.pair, price, amount, taker.id, maker.id, taker.user_id, maker.user_id, takerSide, takerFee, makerFee, quoteVolume]
  );

  return {
    trade: trade.rows[0],
    takerFee,
    makerFee,
    takerRelease,
    makerRelease,
  };
}

async function updateOrderAfterFill(tx, order, { fillAmount, fillPrice, fee, releaseAmount }) {
  const nextFilled = toNum(order.filled) + fillAmount;
  const nextStatus = nextFilled >= toNum(order.amount) ? 'filled' : 'partial';
  const nextAvg = nextAvgPrice(order, fillAmount, fillPrice);
  const nextReserved = Math.max(toNum(order.reserved_amount) - releaseAmount, 0);
  const { rows } = await tx.query(
    `UPDATE spot_orders
        SET filled=$2,
            status=$3,
            reserved_amount=$4,
            fee_paid=COALESCE(fee_paid,0) + $5,
            avg_fill_price=$6,
            last_fill_at=NOW(),
            updated_at=NOW()
      WHERE id=$1
      RETURNING id, user_id, pair, side, type, price, amount, filled, status, reserved_asset, reserved_amount, trigger_price, client_order_id, fee_paid, avg_fill_price, created_at, updated_at, last_fill_at, cancelled_at`,
    [order.id, nextFilled, nextStatus, nextReserved, fee, nextAvg]
  );
  return rows[0];
}

export async function matchOrder(tx, takerOrder, { feeBps, maxLevelsPerOrder = 50 } = {}) {
  let taker = { ...takerOrder };
  const makers = await selectMatchingMakers(tx, taker, maxLevelsPerOrder);
  const trades = [];

  for (const maker of makers) {
    const takerRemaining = remaining(taker);
    if (takerRemaining <= 0) break;
    const makerRemaining = remaining(maker);
    if (makerRemaining <= 0) continue;
    const fillAmount = Math.min(takerRemaining, makerRemaining);
    const fillPrice = toNum(maker.price);
    if (!fillPrice || fillAmount <= 0) continue;

    const settlement = await settleTrade(tx, {
      taker,
      maker,
      amount: fillAmount,
      price: fillPrice,
      feeBps,
    });
    const updatedMaker = await updateOrderAfterFill(tx, maker, {
      fillAmount,
      fillPrice,
      fee: settlement.makerFee,
      releaseAmount: settlement.makerRelease,
    });
    taker = await updateOrderAfterFill(tx, taker, {
      fillAmount,
      fillPrice,
      fee: settlement.takerFee,
      releaseAmount: settlement.takerRelease,
    });
    trades.push({
      ...settlement.trade,
      maker_order: updatedMaker,
      taker_order: taker,
    });
  }

  const filledAmount = toNum(taker.filled) - toNum(takerOrder.filled);
  return {
    order: taker,
    trades,
    filledAmount,
    status: taker.status,
  };
}

export default matchOrder;
