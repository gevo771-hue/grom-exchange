export function toNum(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function computeMarginRequired({ size, price, leverage }) {
  return (toNum(size) * toNum(price)) / Math.max(1, toNum(leverage));
}

export function computeUnrealisedPnL({ side, entry, mark, size }) {
  const dir = side === 'short' ? -1 : 1;
  return (toNum(mark) - toNum(entry)) * dir * toNum(size);
}

export function computeLiqPrice({ side, entry, leverage, mmr = 0.005 }) {
  const entryPx = toNum(entry);
  const lev = Math.max(1, toNum(leverage));
  const maintenance = toNum(mmr);
  if (side === 'short') return entryPx * (1 + (1 / lev) - maintenance);
  return entryPx * (1 - (1 / lev) + maintenance);
}

export function computeBankruptcyPrice({ side, entry, leverage }) {
  const entryPx = toNum(entry);
  const lev = Math.max(1, toNum(leverage));
  if (side === 'short') return entryPx * (1 + (1 / lev));
  return entryPx * (1 - (1 / lev));
}

export function shouldLiquidate({ side, mark, liq }) {
  const markPx = toNum(mark);
  const liqPx = toNum(liq);
  if (!markPx || !liqPx) return false;
  return side === 'short' ? markPx >= liqPx : markPx <= liqPx;
}

export function shouldTriggerTpSl({ side, mark, takeProfit, stopLoss }) {
  const markPx = toNum(mark);
  const tp = takeProfit == null ? null : toNum(takeProfit);
  const sl = stopLoss == null ? null : toNum(stopLoss);
  if (!markPx) return null;
  if (side === 'short') {
    if (tp && markPx <= tp) return 'tp';
    if (sl && markPx >= sl) return 'sl';
    return null;
  }
  if (tp && markPx >= tp) return 'tp';
  if (sl && markPx <= sl) return 'sl';
  return null;
}

export function computeFundingRate({ mark, index, cap = 0.0075 }) {
  const idx = toNum(index);
  if (!idx) return 0;
  return clamp((toNum(mark) - idx) / idx, -Math.abs(cap), Math.abs(cap));
}

export function computeFundingPayment({ side, size, mark, rate }) {
  const signed = toNum(size) * toNum(mark) * toNum(rate);
  return side === 'short' ? signed : -signed;
}

export function computeInsuranceContribution({ equity, contributionPct = 0.05 }) {
  const eq = toNum(equity);
  if (eq <= 0) return 0;
  return eq * toNum(contributionPct);
}

export function riskSnapshot(position, { mmr = 0.005, expectedFundingRate = 0 } = {}) {
  const mark = toNum(position.mark_price);
  const liq = toNum(position.liq_price) || computeLiqPrice({
    side: position.side,
    entry: position.entry_price,
    leverage: position.leverage,
    mmr,
  });
  const distance = position.side === 'short'
    ? ((liq - mark) / mark) * 100
    : ((mark - liq) / mark) * 100;
  return {
    mmr,
    mark_price: mark,
    liq_price: liq,
    distance_to_liq_pct: Number.isFinite(distance) ? distance : 0,
    unrealised_pnl: computeUnrealisedPnL({
      side: position.side,
      entry: position.entry_price,
      mark,
      size: position.size,
    }),
    bankruptcy_price: computeBankruptcyPrice({
      side: position.side,
      entry: position.entry_price,
      leverage: position.leverage,
    }),
    expected_funding: computeFundingPayment({
      side: position.side,
      size: position.size,
      mark,
      rate: expectedFundingRate,
    }),
  };
}
