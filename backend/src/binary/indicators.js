/**
 * Technical indicators for binary options analytics.
 * Pure functions, tested against reference implementations.
 */

/** Simple Moving Average */
export function sma(values, period) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/** Exponential Moving Average */
export function ema(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return e;
}

/**
 * Relative Strength Index (Wilder's smoothing).
 * Returns a value in [0, 100] or null if insufficient data.
 */
export function rsi(values, period = 14) {
  if (values.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** MACD — returns { macd, signal, histogram } */
export function macd(values, fast = 12, slow = 26, signalPeriod = 9) {
  if (values.length < slow + signalPeriod) return null;
  const macdLine = [];
  for (let i = slow - 1; i < values.length; i++) {
    const slice = values.slice(0, i + 1);
    const fastE = ema(slice, fast);
    const slowE = ema(slice, slow);
    if (fastE != null && slowE != null) macdLine.push(fastE - slowE);
  }
  const signal = ema(macdLine, signalPeriod);
  const m = macdLine[macdLine.length - 1];
  return { macd: m, signal, histogram: signal == null ? null : m - signal };
}

/** Bollinger Bands */
export function bollinger(values, period = 20, mult = 2) {
  const mid = sma(values, period);
  if (mid == null) return null;
  const slice = values.slice(-period);
  const variance = slice.reduce((a, v) => a + (v - mid) ** 2, 0) / period;
  const std = Math.sqrt(variance);
  return { upper: mid + mult * std, mid, lower: mid - mult * std };
}

/**
 * Heuristic signal combining RSI + MACD histogram + BB position.
 * Returns { direction: 'up'|'down'|'neutral', probability: 0..1, reason }.
 * This is illustrative — PRODUCTION: replace with backtested model.
 */
export function combinedSignal(values) {
  const r = rsi(values, 14);
  const m = macd(values);
  const bb = bollinger(values);
  const price = values[values.length - 1];
  if (r == null || m == null || bb == null) {
    return { direction: 'neutral', probability: 0.5, reason: 'insufficient-data' };
  }

  let score = 0;
  if (r < 30) score += 1;                 // oversold → up
  else if (r > 70) score -= 1;            // overbought → down
  if (m.histogram != null) score += Math.sign(m.histogram) * 0.8;
  if (price < bb.lower) score += 0.6;
  if (price > bb.upper) score -= 0.6;

  const direction = score > 0.3 ? 'up' : score < -0.3 ? 'down' : 'neutral';
  const probability = Math.min(0.5 + Math.abs(score) * 0.15, 0.85);
  return {
    direction,
    probability,
    reason: `rsi=${r.toFixed(1)} macdH=${m.histogram?.toFixed(2)} bb=${price < bb.lower ? 'below' : price > bb.upper ? 'above' : 'inside'}`,
  };
}
