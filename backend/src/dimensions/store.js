/**
 * GROM dimensions ledger — DefiLlama-grade daily volume/fees source.
 *
 * Rules (see defillama/METHODOLOGY.md):
 * - Only status='confirmed' rows are summed.
 * - Quotes, deposits, funding, dry-run, reverted txs never enter as confirmed.
 * - Fee-wallet transfers alone are not volume.
 * - Periods before INDEXED_FROM → unavailable (not silent zero).
 * - Requested interval must be fully covered by persisted index windows → else 503.
 * - Successfully scanned empty interval → verified zero (200).
 * - Untrusted client reports cannot mutate confirmed identity/evidence.
 */
import { query } from '../db/pool.js';
import logger from '../utils/logger.js';

/** Earliest UTC day we may ever claim coverage (not proof that every chain is covered). */
export const INDEXED_FROM = new Date('2026-08-22T00:00:00.000Z');

export const PRODUCTS = Object.freeze(['swap', 'perps', 'predict', 'xstocks']);

/** Products with an active confirmed-fill ledger. Others → API unavailable. */
export const LEDGER_PRODUCTS = Object.freeze(new Set(['swap']));

export const CHAIN_KEY_BY_ID = Object.freeze({
  1: 'ethereum',
  10: 'optimism',
  56: 'bsc',
  137: 'polygon',
  42161: 'arbitrum',
  43114: 'avax',
  8453: 'base',
  1000001: 'solana',
});

export const CHAIN_ID_BY_KEY = Object.freeze(
  Object.fromEntries(Object.entries(CHAIN_KEY_BY_ID).map(([id, key]) => [key, Number(id)]))
);

export const SOLANA_CHAIN_ID = 1000001;

export function chainKeyForId(chainId) {
  const id = Number(chainId);
  return CHAIN_KEY_BY_ID[id] || `chain_${id}`;
}

/** EVM hashes are case-insensitive; Solana base58 is case-sensitive. */
export function normalizeTxHash(chainId, txHash) {
  const h = String(txHash || '').trim();
  if (!h) return '';
  if (Number(chainId) === SOLANA_CHAIN_ID) return h;
  return h.toLowerCase();
}

/**
 * Whether [startMs, endMs) is fully covered by ok coverage intervals.
 * Intervals are half-open [covered_from, covered_to).
 * Future time is never treatable as verified: requested end > now → not covered,
 * and coverage rows that extend past now are clipped at nowMs.
 */
export function intervalFullyCovered(intervals, startMs, endMs, { nowMs = Date.now() } = {}) {
  const start = Number(startMs);
  const end = Number(endMs);
  const now = Number(nowMs);
  if (!(end > start)) return false;
  if (!(now > 0) || end > now) return false;
  const sorted = (intervals || [])
    .map((r) => {
      const from = new Date(r.covered_from || r.coveredFrom).getTime();
      let to = new Date(r.covered_to || r.coveredTo).getTime();
      if (Number.isFinite(to) && to > now) to = now;
      return { from, to };
    })
    .filter((r) => Number.isFinite(r.from) && Number.isFinite(r.to) && r.to > r.from)
    .sort((a, b) => a.from - b.from);
  if (!sorted.length) return false;

  let cursor = start;
  for (const iv of sorted) {
    if (iv.to <= cursor) continue;
    if (iv.from > cursor) return false;
    cursor = Math.max(cursor, iv.to);
    if (cursor >= end) return true;
  }
  return cursor >= end;
}

/** Start of the current UTC calendar day (unix seconds). */
export function utcDayStartSec(nowMs = Date.now()) {
  const d = new Date(nowMs);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000);
}

/**
 * Latest exclusive toTimestamp we may record as ok coverage.
 * Only completed UTC days (end = start of today UTC), never "now" mid-day.
 */
export function maxCoverableToSec(nowMs = Date.now()) {
  return utcDayStartSec(nowMs);
}

/** Clip a watermark timestamp so meta never advertises the future. */
export function clipWatermarkMs(watermarkMs, nowMs = Date.now()) {
  const w = Number(watermarkMs);
  const now = Number(nowMs);
  if (!Number.isFinite(w) || w <= 0) return null;
  const maxTo = maxCoverableToSec(now) * 1000;
  return Math.min(w, now, maxTo);
}

export function coverageSnapshot({
  product,
  dbOk = true,
  ready = false,
  watermark = null,
  note = null,
} = {}) {
  const ledgerLive = LEDGER_PRODUCTS.has(product);
  let status = 'unavailable';
  if (!dbOk) status = 'error';
  else if (!ledgerLive) status = 'unavailable';
  else if (ready) status = 'ready';
  else status = 'unsynced';

  return {
    status,
    indexedFrom: INDEXED_FROM.toISOString(),
    watermark: watermark ? new Date(watermark).toISOString() : null,
    ledgerProducts: [...LEDGER_PRODUCTS],
    note: note || (ledgerLive
      ? (ready
        ? 'GROM-hosted confirmed fill ledger. Covered empty intervals are verified zero. Partner global volume is never attributed to GROM.'
        : 'Ledger exists but requested coverage is missing or incomplete. Do not treat missing sync as verified zero.')
      : `Product "${product}" has no GROM confirmed-fill indexer yet. Do not treat missing data as zero.`),
  };
}

export async function listCoverageIntervals({ product, chainId, dbQuery = query } = {}) {
  const { rows } = await dbQuery(
    `SELECT covered_from, covered_to, source, status, evidence, updated_at
     FROM dimension_index_coverage
     WHERE product = $1
       AND chain_id = $2
       AND status = 'ok'
     ORDER BY covered_from ASC`,
    [product, Number(chainId)]
  );
  return rows;
}

export async function maxCoverageWatermark({ product, chainId = null, dbQuery = query } = {}) {
  const params = [product];
  let sql = `SELECT MAX(covered_to) AS watermark
             FROM dimension_index_coverage
             WHERE product = $1 AND status = 'ok'`;
  if (chainId != null) {
    sql += ' AND chain_id = $2';
    params.push(Number(chainId));
  }
  const { rows } = await dbQuery(sql, params);
  return rows[0]?.watermark || null;
}

/**
 * Persist a successfully scanned (or failed) index window.
 * Overlapping identical windows upsert evidence; callers should pass explicit bounds.
 * status=ok refuses covered_to in the future or past the last completed UTC day.
 */
export async function recordIndexCoverage(input = {}, { dbQuery = query, nowMs = Date.now() } = {}) {
  const source = String(input.source || '').trim();
  const product = String(input.product || '');
  const chainId = Number(input.chainId);
  const coveredFrom = new Date(input.coveredFrom || input.covered_from);
  const coveredTo = new Date(input.coveredTo || input.covered_to);
  const status = input.status === 'failed' ? 'failed' : 'ok';

  if (!source) throw Object.assign(new Error('coverage_source_required'), { status: 400 });
  if (!PRODUCTS.includes(product)) throw Object.assign(new Error('unknown_product'), { status: 400 });
  if (!Number.isFinite(chainId)) throw Object.assign(new Error('chain_id_required'), { status: 400 });
  if (Number.isNaN(coveredFrom.getTime()) || Number.isNaN(coveredTo.getTime()) || coveredTo <= coveredFrom) {
    throw Object.assign(new Error('invalid_coverage_range'), { status: 400 });
  }
  if (status === 'ok') {
    const maxToMs = maxCoverableToSec(nowMs) * 1000;
    if (coveredTo.getTime() > nowMs || coveredTo.getTime() > maxToMs) {
      const err = new Error('coverage_to_in_future');
      err.status = 400;
      err.code = 'coverage_to_in_future';
      err.details = {
        coveredTo: coveredTo.toISOString(),
        now: new Date(nowMs).toISOString(),
        maxCoverableTo: new Date(maxToMs).toISOString(),
      };
      throw err;
    }
  }

  const { rows } = await dbQuery(
    `INSERT INTO dimension_index_coverage (
       source, product, chain_id, covered_from, covered_to, status, evidence, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb, NOW())
     ON CONFLICT (source, product, chain_id, covered_from, covered_to)
     DO UPDATE SET
       status = EXCLUDED.status,
       evidence = dimension_index_coverage.evidence || EXCLUDED.evidence,
       updated_at = NOW()
     RETURNING id, status, covered_from, covered_to`,
    [
      source,
      product,
      chainId,
      coveredFrom.toISOString(),
      coveredTo.toISOString(),
      status,
      JSON.stringify(input.evidence || {}),
    ]
  );
  return rows[0];
}

/**
 * Invalidate an ok coverage window (set failed) so it cannot satisfy intervalFullyCovered.
 * Preserves the row + merges evidence (audit / backup of prior claim).
 */
export async function invalidateIndexCoverage(input = {}, { dbQuery = query } = {}) {
  const source = String(input.source || '').trim();
  const product = String(input.product || '');
  const chainId = Number(input.chainId);
  const coveredFrom = new Date(input.coveredFrom || input.covered_from);
  const coveredTo = new Date(input.coveredTo || input.covered_to);
  if (!source || !PRODUCTS.includes(product) || !Number.isFinite(chainId)) {
    throw Object.assign(new Error('invalidate_coverage_args'), { status: 400 });
  }
  if (Number.isNaN(coveredFrom.getTime()) || Number.isNaN(coveredTo.getTime())) {
    throw Object.assign(new Error('invalid_coverage_range'), { status: 400 });
  }
  const evidence = {
    invalidatedAt: new Date().toISOString(),
    reason: input.reason || 'invalidated',
    ...(input.evidence || {}),
  };
  const { rows } = await dbQuery(
    `UPDATE dimension_index_coverage
     SET status = 'failed',
         evidence = COALESCE(evidence, '{}'::jsonb) || $6::jsonb,
         updated_at = NOW()
     WHERE source = $1 AND product = $2 AND chain_id = $3
       AND covered_from = $4 AND covered_to = $5
       AND status = 'ok'
     RETURNING id, source, product, chain_id, covered_from, covered_to, status, evidence`,
    [
      source,
      product,
      chainId,
      coveredFrom.toISOString(),
      coveredTo.toISOString(),
      JSON.stringify(evidence),
    ]
  );
  return rows;
}

/** List ok coverage rows whose covered_to is past now or past the last completed UTC day. */
export async function listInvalidFutureCoverage({ dbQuery = query, nowMs = Date.now() } = {}) {
  const maxTo = new Date(maxCoverableToSec(nowMs) * 1000).toISOString();
  const { rows } = await dbQuery(
    `SELECT id, source, product, chain_id, covered_from, covered_to, status, evidence
     FROM dimension_index_coverage
     WHERE status = 'ok' AND covered_to > $1::timestamptz
     ORDER BY covered_to DESC, chain_id ASC`,
    [maxTo]
  );
  return rows;
}

export async function assertIntervalCovered({
  product,
  chainId,
  startTimestamp,
  endTimestamp,
  dbQuery = query,
  nowMs = Date.now(),
} = {}) {
  const startMs = Number(startTimestamp) * 1000;
  const endMs = Number(endTimestamp) * 1000;
  if (endMs > nowMs) {
    const err = new Error('interval_extends_into_future');
    err.code = 'NO_DATA';
    err.status = 503;
    err.coverage = coverageSnapshot({
      product,
      dbOk: true,
      ready: false,
      note: `Requested end ${new Date(endMs).toISOString()} is still in the future — cannot claim verified coverage.`,
    });
    throw err;
  }
  let intervals;
  try {
    intervals = await listCoverageIntervals({ product, chainId, dbQuery });
  } catch (err) {
    const e = new Error('dimensions_store_unavailable');
    e.code = 'UPSTREAM_ERROR';
    e.status = 503;
    e.coverage = coverageSnapshot({ product, dbOk: false });
    throw e;
  }
  if (!intervalFullyCovered(intervals, startMs, endMs, { nowMs })) {
    const watermark = intervals.reduce((max, r) => {
      const t = new Date(r.covered_to).getTime();
      return Number.isFinite(t) && t > max ? t : max;
    }, 0);
    const clipped = clipWatermarkMs(watermark, nowMs);
    const err = new Error('interval_not_indexed');
    err.code = 'NO_DATA';
    err.status = 503;
    err.coverage = coverageSnapshot({
      product,
      dbOk: true,
      ready: false,
      watermark: clipped,
      note: `No complete index coverage for chain ${chainId} over [${startTimestamp},${endTimestamp}).`,
    });
    throw err;
  }
  const watermark = intervals.reduce((max, r) => {
    const t = new Date(r.covered_to).getTime();
    return Number.isFinite(t) && t > max ? t : max;
  }, 0);
  return { watermark: clipWatermarkMs(watermark, nowMs), intervals };
}

/**
 * Sum confirmed fills for [startTs, endTs) half-open UTC seconds.
 * Throws coded errors for unavailable periods / products / missing coverage.
 */
export async function queryDailyDimensions({
  product,
  chainId = null,
  chainKey = null,
  startTimestamp,
  endTimestamp,
  dbQuery = query,
  nowMs = Date.now(),
} = {}) {
  if (!PRODUCTS.includes(product)) {
    const err = new Error(`unknown_product:${product}`);
    err.code = 'BAD_REQUEST';
    err.status = 400;
    throw err;
  }

  const start = Number(startTimestamp);
  const end = Number(endTimestamp);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    const err = new Error('invalid_time_range');
    err.code = 'BAD_REQUEST';
    err.status = 400;
    throw err;
  }

  if (!LEDGER_PRODUCTS.has(product)) {
    const err = new Error(`no_indexer_for_product:${product}`);
    err.code = 'NO_DATA';
    err.status = 503;
    err.coverage = coverageSnapshot({ product, dbOk: true, ready: false });
    throw err;
  }

  const startMs = start * 1000;
  if (startMs < INDEXED_FROM.getTime()) {
    const err = new Error('period_before_index');
    err.code = 'NO_DATA';
    err.status = 503;
    err.coverage = coverageSnapshot({ product, dbOk: true, ready: false });
    throw err;
  }

  let resolvedChainId = chainId != null && chainId !== '' ? Number(chainId) : null;
  if ((resolvedChainId == null || Number.isNaN(resolvedChainId)) && chainKey) {
    resolvedChainId = CHAIN_ID_BY_KEY[String(chainKey)] ?? null;
  }
  if (resolvedChainId == null || Number.isNaN(resolvedChainId)) {
    const err = new Error('chain_required');
    err.code = 'BAD_REQUEST';
    err.status = 400;
    throw err;
  }

  const covered = await assertIntervalCovered({
    product,
    chainId: resolvedChainId,
    startTimestamp: start,
    endTimestamp: end,
    dbQuery,
    nowMs,
  });

  try {
    const { rows } = await dbQuery(
      `SELECT
         COALESCE(SUM(volume_usd), 0)::text AS volume_usd,
         COALESCE(SUM(fee_usd), 0)::text AS fee_usd,
         COUNT(*)::int AS fill_count
       FROM dimension_fills
       WHERE status = 'confirmed'
         AND product = $1
         AND chain_id = $2
         AND executed_at >= to_timestamp($3)
         AND executed_at <  to_timestamp($4)`,
      [product, resolvedChainId, start, end]
    );

    const row = rows[0] || {};
    return {
      ok: true,
      product,
      chainId: resolvedChainId,
      chainKey: chainKeyForId(resolvedChainId),
      startTimestamp: start,
      endTimestamp: end,
      dailyVolumeUsd: Number(row.volume_usd || 0),
      dailyFeesUsd: Number(row.fee_usd || 0),
      fillCount: Number(row.fill_count || 0),
      coverage: coverageSnapshot({
        product,
        dbOk: true,
        ready: true,
        watermark: covered.watermark,
      }),
    };
  } catch (err) {
    if (err.code === 'NO_DATA' || err.code === 'BAD_REQUEST' || err.code === 'UPSTREAM_ERROR') throw err;
    logger.error({ err: err.message, product, chainId: resolvedChainId }, 'dimensions query failed');
    const e = new Error('dimensions_store_unavailable');
    e.code = 'UPSTREAM_ERROR';
    e.status = 503;
    e.coverage = coverageSnapshot({ product, dbOk: false });
    throw e;
  }
}

/**
 * Insert a reported or confirmed fill. Dedupes on (chain_id, tx_hash, log_index).
 * @param {object} opts
 * @param {boolean} [opts.trusted=false] — admin / indexer path may set confirmed + mutate.
 *   Untrusted client reports never change confirmed identity, attribution, or evidence.
 */
export async function upsertFill(input = {}, opts = {}) {
  const dbQuery = opts.dbQuery || query;
  const trusted = !!opts.trusted;

  const product = String(input.product || '');
  if (!PRODUCTS.includes(product)) {
    const err = new Error('unknown_product');
    err.status = 400;
    throw err;
  }
  const chainId = Number(input.chainId);
  if (!Number.isFinite(chainId)) {
    const err = new Error('chain_id_required');
    err.status = 400;
    throw err;
  }
  const txHashRaw = String(input.txHash || '').trim();
  if (!txHashRaw) {
    const err = new Error('tx_hash_required');
    err.status = 400;
    throw err;
  }
  const txNorm = normalizeTxHash(chainId, txHashRaw);
  const executedAt = input.executedAt ? new Date(input.executedAt) : new Date();
  if (Number.isNaN(executedAt.getTime())) {
    const err = new Error('invalid_executed_at');
    err.status = 400;
    throw err;
  }

  let status = input.status === 'confirmed' ? 'confirmed' : 'reported';
  if (!trusted && status === 'confirmed') {
    status = 'reported';
  }

  const volumeUsd = Math.max(0, Number(input.volumeUsd) || 0);
  const feeUsd = Math.max(0, Number(input.feeUsd) || 0);
  if (status === 'confirmed' && volumeUsd <= 0 && feeUsd <= 0) {
    const err = new Error('confirmed_fill_requires_volume_or_fee');
    err.status = 400;
    throw err;
  }

  const logIndex = input.logIndex != null && Number.isFinite(Number(input.logIndex))
    ? Number(input.logIndex)
    : null;
  const fillId = input.fillId ? String(input.fillId) : null;
  const chainKey = input.chainKey || chainKeyForId(chainId);
  const dedupeKey = input.fillId
    ? `${product}:fill:${String(input.fillId)}`
    : `${chainId}:${txNorm}:${logIndex == null ? -1 : logIndex}`;

  /* Fast path: untrusted must not touch confirmed rows (identity / evidence immutable). */
  if (!trusted) {
    const existing = await dbQuery(
      `SELECT id, status, product, fill_id, router, attribution, volume_usd::text, fee_usd::text,
              evidence, tx_hash, chain_id, dedupe_key
       FROM dimension_fills WHERE dedupe_key = $1`,
      [dedupeKey]
    );
    if (existing.rows[0]?.status === 'confirmed') {
      return existing.rows[0];
    }
  }

  const onConflict = trusted
    ? `ON CONFLICT (dedupe_key)
       DO UPDATE SET
         product = EXCLUDED.product,
         fill_id = COALESCE(EXCLUDED.fill_id, dimension_fills.fill_id),
         router = COALESCE(EXCLUDED.router, dimension_fills.router),
         attribution = COALESCE(EXCLUDED.attribution, dimension_fills.attribution),
         volume_usd = CASE
           WHEN EXCLUDED.status = 'confirmed' THEN EXCLUDED.volume_usd
           ELSE dimension_fills.volume_usd
         END,
         fee_usd = CASE
           WHEN EXCLUDED.status = 'confirmed' THEN EXCLUDED.fee_usd
           ELSE dimension_fills.fee_usd
         END,
         status = CASE
           WHEN dimension_fills.status = 'confirmed' OR EXCLUDED.status = 'confirmed' THEN 'confirmed'
           ELSE EXCLUDED.status
         END,
         evidence = CASE
           WHEN EXCLUDED.status = 'confirmed' THEN EXCLUDED.evidence
           ELSE dimension_fills.evidence || EXCLUDED.evidence
         END,
         confirmed_at = CASE
           WHEN EXCLUDED.status = 'confirmed' THEN COALESCE(dimension_fills.confirmed_at, NOW())
           ELSE dimension_fills.confirmed_at
         END`
    : `ON CONFLICT (dedupe_key)
       DO UPDATE SET
         router = CASE
           WHEN dimension_fills.status = 'confirmed' THEN dimension_fills.router
           ELSE COALESCE(EXCLUDED.router, dimension_fills.router)
         END,
         volume_usd = CASE
           WHEN dimension_fills.status = 'confirmed' THEN dimension_fills.volume_usd
           ELSE EXCLUDED.volume_usd
         END,
         fee_usd = CASE
           WHEN dimension_fills.status = 'confirmed' THEN dimension_fills.fee_usd
           ELSE EXCLUDED.fee_usd
         END,
         status = CASE
           WHEN dimension_fills.status = 'confirmed' THEN 'confirmed'
           ELSE EXCLUDED.status
         END,
         evidence = CASE
           WHEN dimension_fills.status = 'confirmed' THEN dimension_fills.evidence
           ELSE dimension_fills.evidence || EXCLUDED.evidence
         END
       WHERE dimension_fills.status IS DISTINCT FROM 'confirmed'`;

  const { rows } = await dbQuery(
    `INSERT INTO dimension_fills (
       dedupe_key, product, chain_id, chain_key, tx_hash, log_index, fill_id, executed_at,
       router, attribution, volume_usd, fee_usd,
       token_in, token_out, amount_in, amount_out, decimals_in, decimals_out,
       status, evidence, wallet_address, confirmed_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,
       $9,$10,$11,$12,
       $13,$14,$15,$16,$17,$18,
       $19,$20::jsonb,$21,$22
     )
     ${onConflict}
     RETURNING id, status, product, fill_id, router, attribution, volume_usd::text, fee_usd::text,
               evidence, tx_hash, chain_id, dedupe_key`,
    [
      dedupeKey,
      product,
      chainId,
      chainKey,
      txNorm,
      logIndex,
      fillId,
      executedAt.toISOString(),
      input.router || null,
      input.attribution || null,
      volumeUsd,
      feeUsd,
      input.tokenIn || null,
      input.tokenOut || null,
      input.amountIn != null ? String(input.amountIn) : null,
      input.amountOut != null ? String(input.amountOut) : null,
      input.decimalsIn != null ? Number(input.decimalsIn) : null,
      input.decimalsOut != null ? Number(input.decimalsOut) : null,
      status,
      JSON.stringify(input.evidence || {}),
      input.wallet
        ? (Number(chainId) === SOLANA_CHAIN_ID
          ? String(input.wallet)
          : String(input.wallet).toLowerCase())
        : null,
      status === 'confirmed' ? new Date().toISOString() : null,
    ]
  );

  if (!rows[0] && !trusted) {
    const again = await dbQuery(
      `SELECT id, status, product, fill_id, router, attribution, volume_usd::text, fee_usd::text,
              evidence, tx_hash, chain_id, dedupe_key
       FROM dimension_fills WHERE dedupe_key = $1`,
      [dedupeKey]
    );
    return again.rows[0] || null;
  }
  return rows[0];
}

export async function confirmFill({ id, volumeUsd, feeUsd, evidence = {} } = {}, { dbQuery = query } = {}) {
  const { rows } = await dbQuery(
    `UPDATE dimension_fills
     SET status = 'confirmed',
         volume_usd = COALESCE($2, volume_usd),
         fee_usd = COALESCE($3, fee_usd),
         evidence = evidence || $4::jsonb,
         confirmed_at = NOW()
     WHERE id = $1
     RETURNING id, status, volume_usd::text, fee_usd::text, product, chain_id, tx_hash`,
    [
      Number(id),
      volumeUsd != null ? Number(volumeUsd) : null,
      feeUsd != null ? Number(feeUsd) : null,
      JSON.stringify(evidence),
    ]
  );
  return rows[0] || null;
}

/** Build /meta payload from DB — never invent readiness without coverage rows. */
export async function buildMetaPayload({ dbQuery = query, nowMs = Date.now() } = {}) {
  let coverageByProduct = {};
  let chainsCovered = {};
  try {
    const { rows } = await dbQuery(
      `SELECT product, chain_id,
              MIN(covered_from) AS first_from,
              MAX(covered_to) AS watermark,
              COUNT(*)::int AS windows
       FROM dimension_index_coverage
       WHERE status = 'ok'
       GROUP BY product, chain_id`
    );
    for (const p of PRODUCTS) {
      const ledgerLive = LEDGER_PRODUCTS.has(p);
      const productRows = rows.filter((r) => r.product === p);
      const watermark = productRows.reduce((max, r) => {
        const t = new Date(r.watermark).getTime();
        return Number.isFinite(t) && t > max ? t : max;
      }, 0);
      const clippedWm = clipWatermarkMs(watermark, nowMs);
      coverageByProduct[p] = coverageSnapshot({
        product: p,
        dbOk: true,
        ready: ledgerLive && productRows.length > 0,
        watermark: clippedWm,
        note: !ledgerLive
          ? undefined
          : productRows.length
            ? `Indexed windows present on ${productRows.length} chain(s). Readiness is per-chain; a BSC import alone does not cover other chains. Watermark never extends past the last completed UTC day.`
            : 'No successful index coverage recorded yet.',
      });
      if (ledgerLive) {
        chainsCovered[p] = Object.fromEntries(
          productRows.map((r) => {
            const rawWm = new Date(r.watermark).getTime();
            const wm = clipWatermarkMs(rawWm, nowMs);
            return [
              chainKeyForId(r.chain_id),
              {
                chainId: Number(r.chain_id),
                windows: Number(r.windows),
                firstFrom: r.first_from,
                watermark: wm ? new Date(wm).toISOString() : null,
              },
            ];
          })
        );
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, 'dimensions meta coverage query failed');
    const e = new Error('dimensions_store_unavailable');
    e.code = 'UPSTREAM_ERROR';
    e.status = 503;
    throw e;
  }

  return {
    ok: true,
    indexedFrom: INDEXED_FROM.toISOString(),
    products: PRODUCTS,
    ledgerProducts: [...LEDGER_PRODUCTS],
    chains: CHAIN_KEY_BY_ID,
    chainsCovered,
    parent: parentProjectMetadata(),
    coverageByProduct,
    methodologyUrl: 'https://grom.exchange/api/public/dimensions/meta',
    rules: [
      'Only confirmed fills contribute to dailyVolumeUsd / dailyFeesUsd.',
      'Half-open UTC window [startTimestamp, endTimestamp).',
      'Per-chain results only — never repeat all-chain totals per chain.',
      'Requested interval must be fully covered by persisted index windows; otherwise HTTP 503 NO_DATA.',
      'Successfully scanned empty interval returns HTTP 200 with verified zeros.',
      'Periods before indexedFrom or products without a ledger return HTTP 503 NO_DATA (not zero).',
      'Intervals that extend into the future are never ready (HTTP 503), even if a bad coverage row exists.',
      'Ok coverage is limited to completed UTC days (exclusive to ≤ start of current UTC day).',
      'Fee-wallet transfers alone are not volume; fees are recorded separately from volume.',
      'A last fill timestamp alone is not an index watermark.',
      'LiFi integrator=grom-exchange Instant Swap only — other GROM routers are out of scope until indexed.',
    ],
  };
}

export function parentProjectMetadata() {
  return {
    name: 'GROM',
    website: 'https://grom.exchange',
    twitter: 'https://x.com/gromexchange',
    telegram: 'https://t.me/grom_finence_hub',
    contact: 'support.grom@gmail.com',
    products: [
      {
        id: 'swap',
        label: 'DEX Instant Swap (aggregator)',
        defillamaDashboard: 'aggregators',
        attribution: 'GROM-routed executed swaps (integrator / partner / fee evidence). Not underlying DEX venue TVL.',
        ledger: 'ready_when_covered',
        notes: 'xStocks token swaps share Instant Swap rails; counted once under swap when confirmed, not double-counted as separate DEX volume. Public API is ready only for chains/windows with recorded index coverage.',
      },
      {
        id: 'perps',
        label: 'Perpetual futures (builder)',
        defillamaDashboard: 'aggregator-derivatives (subject to maintainer review)',
        attribution: 'GROM builder-fee attributed fills only — never venue global volume.',
        ledger: 'unavailable',
        notes: 'No GROM confirmed-fill indexer yet. Do not publish zeros as verified.',
      },
      {
        id: 'predict',
        label: 'Prediction Markets',
        defillamaDashboard: 'TBD with DefiLlama maintainers',
        attribution: 'GROM builder / filled trades only — never market-wide venue volume.',
        ledger: 'unavailable',
        notes: 'No GROM confirmed-fill indexer yet.',
      },
      {
        id: 'xstocks',
        label: 'Tokenized stocks (RWA spot swaps)',
        defillamaDashboard: 'same rails as Instant Swap; not a separate TVL claim from branding alone',
        attribution: 'Token swaps via Instant Swap; perpetual stock exposure (if any) is out of scope for this ledger.',
        ledger: 'via_swap',
        notes: 'Confirmed Instant Swap fills that happen to trade stock tokens are product=swap only. Do not also sum product=xstocks into the aggregator total.',
      },
    ],
  };
}
