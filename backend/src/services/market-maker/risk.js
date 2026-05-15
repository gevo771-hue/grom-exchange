export function checkRisk({ pair, side, size, currentPosition = {}, config = {}, hedgeHealth = true }) {
  if (!hedgeHealth) return { ok: false, reason: 'hedge_unavailable' };
  const direction = side === 'buy' ? 1 : -1;
  const nextPosition = Number(currentPosition.net_position || 0) + direction * Number(size || 0);
  if (Math.abs(nextPosition) > Number(config.maxPositionBase || Infinity)) {
    return { ok: false, reason: 'max_position_exceeded', pair, nextPosition };
  }
  if (Number(currentPosition.unrealised_pnl_usdt || 0) < -Math.abs(Number(config.maxDrawdownUsdt || Infinity))) {
    return { ok: false, reason: 'pair_drawdown_exceeded', pair };
  }
  return { ok: true, nextPosition };
}

export function assessKillSwitch({ positions = [], config = {} }) {
  const maxDrawdown = Math.abs(Number(config.maxTotalDrawdownUsdt || Infinity));
  const totalPnl = positions.reduce((sum, pos) => (
    sum + Number(pos.realised_pnl_usdt || 0) + Number(pos.unrealised_pnl_usdt || 0)
  ), 0);
  return {
    triggered: totalPnl < -maxDrawdown,
    totalPnl,
    reason: totalPnl < -maxDrawdown ? 'total_drawdown_exceeded' : null,
  };
}

export default { checkRisk, assessKillSwitch };
