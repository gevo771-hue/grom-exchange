/**
 * Local mirror of helpers/aggregators/grom.ts for GROM backend unit tests.
 * Upstream DefiLlama PR uses helpers/aggregators/grom.ts (not this file under
 * aggregators/ — CI would treat it as a runnable adapter).
 *
 * Fail closed: never coerce false / "" / [] into 0 via Number().
 */

/**
 * @param {unknown} n
 * @param {string} label
 * @returns {number}
 */
export function assertFiniteNonNeg(n, label) {
  if (n === null || n === undefined) {
    throw new Error(`grom aggregator: missing ${label}`);
  }
  if (typeof n === 'boolean' || Array.isArray(n) || (typeof n === 'object')) {
    throw new Error(`grom aggregator: invalid ${label}=${String(n)}`);
  }
  if (typeof n === 'string') {
    const t = n.trim();
    if (!t || !/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(t)) {
      throw new Error(`grom aggregator: invalid ${label}=${String(n)}`);
    }
    const v = Number(t);
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(`grom aggregator: invalid ${label}=${String(n)}`);
    }
    return v;
  }
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
    throw new Error(`grom aggregator: invalid ${label}=${String(n)}`);
  }
  return n;
}

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {Record<string, unknown>}
 */
function asRecord(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`grom aggregator: invalid ${label}`);
  }
  return /** @type {Record<string, unknown>} */ (value);
}

/**
 * @param {unknown} data
 * @param {{ chainKey: string, startTimestamp: number, endTimestamp: number }} want
 */
export function assertOkDimensionsResponse(data, want) {
  const body = asRecord(data, 'response');

  if (body.ok !== true) {
    throw new Error(
      `grom aggregator: rejected response for ${want.chainKey} [${want.startTimestamp},${want.endTimestamp}): ${String(body.code || '')} ${String(body.error || 'ok!==true')}`
    );
  }

  const coverage = asRecord(body.coverage, 'coverage');
  if (coverage.status !== 'ready') {
    throw new Error(
      `grom aggregator: coverage not ready for ${want.chainKey}: ${String(coverage.status || 'missing')}`
    );
  }

  if (typeof body.chainKey !== 'string' || !body.chainKey.trim()) {
    throw new Error(`grom aggregator: missing chainKey for ${want.chainKey}`);
  }
  if (body.chainKey !== want.chainKey) {
    throw new Error(
      `grom aggregator: chainKey mismatch want=${want.chainKey} got=${body.chainKey}`
    );
  }

  const gotStart = assertFiniteNonNeg(body.startTimestamp, 'startTimestamp');
  const gotEnd = assertFiniteNonNeg(body.endTimestamp, 'endTimestamp');
  if (gotStart !== Number(want.startTimestamp) || gotEnd !== Number(want.endTimestamp)) {
    throw new Error(
      `grom aggregator: window mismatch want=[${want.startTimestamp},${want.endTimestamp}) got=[${gotStart},${gotEnd})`
    );
  }

  const volume = assertFiniteNonNeg(body.dailyVolumeUsd, 'dailyVolumeUsd');
  const fees = assertFiniteNonNeg(body.dailyFeesUsd, 'dailyFeesUsd');
  return { volume, fees };
}
