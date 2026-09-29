/**
 * Exact decimal-string → base-unit BigInt conversion.
 * Never use Number × 10**decimals for swap amounts (float drops wei).
 */

export function assertValidDecimals(decimals) {
  if (decimals === null || decimals === undefined || decimals === '') {
    const err = new Error(`invalid decimals: ${decimals}`);
    err.status = 400;
    err.code = 'invalid_decimals';
    throw err;
  }
  const d = Number(decimals);
  if (!Number.isInteger(d) || d < 0 || d > 36) {
    const err = new Error(`invalid decimals: ${decimals}`);
    err.status = 400;
    err.code = 'invalid_decimals';
    throw err;
  }
  return d;
}

/**
 * Parse a non-negative decimal amount string into base units.
 * @param {string|number} amount
 * @param {number} decimals
 * @param {{ truncate?: boolean }} [opts] truncate=true drops excess fractional digits;
 *   truncate=false (default) rejects excess precision.
 * @returns {bigint}
 */
export function parseAmountToUnits(amount, decimals, opts = {}) {
  const d = assertValidDecimals(decimals);
  const truncate = !!opts.truncate;

  if (amount == null || amount === '') {
    const err = new Error('amount required');
    err.status = 400;
    err.code = 'invalid_amount';
    throw err;
  }
  if (typeof amount === 'number') {
    if (!Number.isFinite(amount) || amount < 0) {
      const err = new Error('invalid amount number');
      err.status = 400;
      err.code = 'invalid_amount';
      throw err;
    }
    // Convert via string to avoid scientific notation surprises for mid-range values.
    amount = String(amount);
  }

  let s = String(amount).trim().replace(/,/g, '');
  if (!s || s === '.') {
    const err = new Error('invalid amount');
    err.status = 400;
    err.code = 'invalid_amount';
    throw err;
  }
  if (s.startsWith('+')) s = s.slice(1);
  if (s.startsWith('-')) {
    const err = new Error('amount must be non-negative');
    err.status = 400;
    err.code = 'invalid_amount';
    throw err;
  }
  if (/[eE]/.test(s)) {
    // Reject scientific notation — forces explicit decimal form.
    const err = new Error('scientific notation not allowed');
    err.status = 400;
    err.code = 'invalid_amount';
    throw err;
  }
  if (!/^\d+(\.\d+)?$/.test(s)) {
    const err = new Error('invalid amount format');
    err.status = 400;
    err.code = 'invalid_amount';
    throw err;
  }

  let [whole, frac = ''] = s.split('.');
  whole = whole.replace(/^0+(?=\d)/, '') || '0';
  if (frac.length > d) {
    if (!truncate) {
      const err = new Error(`too many fractional digits for decimals=${d}`);
      err.status = 400;
      err.code = 'excess_precision';
      throw err;
    }
    frac = frac.slice(0, d);
  } else {
    frac = frac.padEnd(d, '0');
  }

  const units = BigInt(whole) * (10n ** BigInt(d)) + BigInt(frac || '0');
  if (units <= 0n) {
    const err = new Error('amount must be > 0');
    err.status = 400;
    err.code = 'invalid_amount';
    throw err;
  }
  // Guard absurd sizes (≈ 2^256)
  if (units > (1n << 256n) - 1n) {
    const err = new Error('amount too large');
    err.status = 400;
    err.code = 'amount_too_large';
    throw err;
  }
  return units;
}

export function unitsToString(units, decimals) {
  const d = assertValidDecimals(decimals);
  const u = BigInt(units);
  const neg = u < 0n;
  const abs = neg ? -u : u;
  const base = 10n ** BigInt(d);
  const whole = abs / base;
  const frac = abs % base;
  let fracStr = frac.toString().padStart(d, '0').replace(/0+$/, '');
  const body = fracStr ? `${whole}.${fracStr}` : whole.toString();
  return neg ? `-${body}` : body;
}

export default { parseAmountToUnits, unitsToString, assertValidDecimals };
