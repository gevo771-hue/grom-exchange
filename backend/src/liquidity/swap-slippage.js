/**
 * Instant Swap slippage normalization.
 * Settings UI stores PERCENT (0.5 = 0.5%, label "0.5 %").
 * Quote/build APIs need a FRACTION (0.005).
 */
export function normalizeSlippageToFraction(raw, fallback = 0.005) {
  if (raw == null || raw === '') return fallback;
  let s = String(raw).trim().replace(/%/g, '').replace(/\s+/g, '');
  if (!s) return fallback;
  // European "0,5" → 0.5 when no dot present
  if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  // Values > 50 are out of settings range (0.05–10%) — reject
  if (n > 50) return fallback;
  // Settings / prefs ALWAYS store percent. 0.5 → 0.005, 1 → 0.01, 5 → 0.05.
  // Do NOT treat n≤1 as an already-normalized fraction (that turned 0.5% into 50%).
  let frac = n / 100;
  if (frac > 0.5) frac = 0.5;
  if (frac < 0.0001) frac = 0.0001; // 0.01% floor
  return frac;
}

/** Format fraction for UI percent label (0.005 → "0.50"). */
export function slippageFractionToPercentLabel(frac) {
  const f = Number(frac);
  if (!Number.isFinite(f) || f <= 0) return '0.50';
  return (f * 100).toFixed(2).replace(/\.?0+$/, '') || '0.5';
}

export default { normalizeSlippageToFraction, slippageFractionToPercentLabel };
