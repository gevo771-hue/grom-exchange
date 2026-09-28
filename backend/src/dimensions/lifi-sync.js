/**
 * Sync GROM-attributed Instant Swap volume from LiFi analytics.
 * Only DONE transfers with metadata.integrator === 'grom-exchange'.
 * Volume = LiFi sending.amountUSD at execution (not current prices).
 * Fees = integrator share of feeCosts only (never fee÷0.002 inference).
 *
 * Coverage scope: Instant Swap fills attributed via LiFi integrator only.
 * A successful complete scan may mark ledger chains as covered for that
 * LI.FI source window — it does NOT claim CoWSwap / other GROM routers.
 *
 * Coverage is recorded only when fromTimestamp is provided. Malformed API
 * payloads, truncated/incomplete pagination, map failures on GROM-attributed
 * DONE transfers, upsert errors, or coverage-write failures → not ok.
 * Ok coverage never extends past the last completed UTC day / scan start.
 */
import axios from 'axios';
import logger from '../utils/logger.js';
import {
  upsertFill,
  recordIndexCoverage,
  CHAIN_KEY_BY_ID,
  INDEXED_FROM,
  maxCoverableToSec,
} from './store.js';

export const LIFI_INTEGRATOR = 'grom-exchange';
/** Paginated analytics API — v1 caps at 1000 with no cursor. */
export const LIFI_TRANSFERS_V2_URL = 'https://li.quest/v2/analytics/transfers';
const DEFAULT_PAGE_LIMIT = 100;
const MAX_PAGES = 200;

export class LifiTransfersResponseError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'LifiTransfersResponseError';
    this.code = 'lifi_transfers_invalid';
    this.details = details;
  }
}

export function integratorFeeUsdFromTransfer(transfer) {
  let feeUsd = 0;
  for (const f of transfer?.feeCosts || []) {
    const split = f.feeSplit || {};
    const integ = Number(split.integratorFee || 0);
    const amount = Number(f.amount || 0);
    const amountUsd = Number(f.amountUSD || 0);
    if (integ > 0 && amount > 0 && Number.isFinite(amountUsd)) {
      feeUsd += amountUsd * (integ / amount);
    }
  }
  return Math.max(0, feeUsd);
}

/**
 * Map one LiFi analytics transfer → upsertFill input, or null if not attributable.
 */
export function mapLifiTransferToFill(transfer) {
  if (!transfer || String(transfer.status).toUpperCase() !== 'DONE') return null;
  const integrator = transfer.metadata?.integrator || transfer.integrator;
  if (String(integrator || '') !== LIFI_INTEGRATOR) return null;

  const sending = transfer.sending || {};
  const receiving = transfer.receiving || {};
  const txHash = sending.txHash || receiving.txHash;
  const chainId = Number(sending.chainId || receiving.chainId);
  const ts = Number(sending.timestamp || receiving.timestamp || 0);
  if (!txHash || !Number.isFinite(chainId) || !ts) return null;

  const volumeUsd = Number(sending.amountUSD);
  if (!Number.isFinite(volumeUsd) || volumeUsd <= 0) return null;

  const feeUsd = integratorFeeUsdFromTransfer(transfer);
  const tokenIn = sending.token || {};
  const tokenOut = receiving.token || {};

  return {
    product: 'swap',
    chainId,
    txHash,
    fillId: transfer.transactionId ? `lifi:${transfer.transactionId}` : null,
    executedAt: new Date(ts * 1000).toISOString(),
    router: String(transfer.tool || 'lifi'),
    attribution: `lifi:${LIFI_INTEGRATOR}`,
    volumeUsd,
    feeUsd,
    tokenIn: tokenIn.address || null,
    tokenOut: tokenOut.address || null,
    amountIn: sending.amount != null ? String(sending.amount) : null,
    amountOut: receiving.amount != null ? String(receiving.amount) : null,
    decimalsIn: tokenIn.decimals != null ? Number(tokenIn.decimals) : null,
    decimalsOut: tokenOut.decimals != null ? Number(tokenOut.decimals) : null,
    status: 'confirmed',
    wallet: transfer.fromAddress || null,
    evidence: {
      source: 'lifi_analytics',
      integrator: LIFI_INTEGRATOR,
      transactionId: transfer.transactionId || null,
      lifiExplorerLink: transfer.lifiExplorerLink || null,
      sendingAmountUSD: sending.amountUSD,
      receivingAmountUSD: receiving.amountUSD,
      feeCosts: transfer.feeCosts || [],
      note: 'Confirmed via LiFi DONE transfer with grom-exchange integrator metadata.',
    },
  };
}

function isGromDoneTransfer(transfer) {
  if (!transfer || String(transfer.status).toUpperCase() !== 'DONE') return false;
  const integrator = transfer.metadata?.integrator || transfer.integrator;
  return String(integrator || '') === LIFI_INTEGRATOR;
}

/**
 * Validate sync window. Future toTimestamp → explicit error (never silent truncate).
 * Ok coverage is limited to completed UTC days (to ≤ start of current UTC day).
 */
export function assertSyncWindow({ fromTimestamp, toTimestamp, nowMs = Date.now() } = {}) {
  const from = Number(fromTimestamp);
  const to = Number(toTimestamp);
  const nowSec = Math.floor(Number(nowMs) / 1000);
  const maxTo = maxCoverableToSec(nowMs);

  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    const err = new Error('invalid_sync_window');
    err.code = 'invalid_sync_window';
    throw err;
  }
  if (from * 1000 < INDEXED_FROM.getTime()) {
    const err = new Error('sync_window_before_indexed_from');
    err.code = 'sync_window_before_indexed_from';
    throw err;
  }
  if (to > nowSec) {
    const err = new Error('sync_to_in_future');
    err.code = 'sync_to_in_future';
    err.details = {
      toTimestamp: to,
      nowSec,
      toIso: new Date(to * 1000).toISOString(),
      nowIso: new Date(nowMs).toISOString(),
    };
    throw err;
  }
  if (to > maxTo) {
    const err = new Error('sync_to_beyond_completed_utc_day');
    err.code = 'sync_to_beyond_completed_utc_day';
    err.details = {
      toTimestamp: to,
      maxCoverableToSec: maxTo,
      maxCoverableToIso: new Date(maxTo * 1000).toISOString(),
      note: 'Index only completed UTC days (exclusive to = start of current UTC day).',
    };
    throw err;
  }
  return { fromTimestamp: from, toTimestamp: to, maxCoverableToSec: maxTo, nowSec };
}

/**
 * Validate LI.FI analytics payload. Only a real transfers/data array is accepted.
 * `{}`, null, transfers:null, transfers:{} → throw (must not become verified zero).
 * `{ transfers: [] }` / `{ data: [], hasNext:false }` → empty list OK.
 * v2 requires boolean hasNext (missing/non-boolean is not treated as end-of-pages).
 */
export function parseLifiTransfersPayload(data, { apiVersion = 'v2' } = {}) {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    throw new LifiTransfersResponseError('lifi_transfers_invalid_payload', {
      dataType: data == null ? String(data) : Array.isArray(data) ? 'array' : typeof data,
    });
  }

  if (apiVersion === 'v1') {
    if (!Object.prototype.hasOwnProperty.call(data, 'transfers')) {
      throw new LifiTransfersResponseError('lifi_transfers_missing_transfers');
    }
    if (!Array.isArray(data.transfers)) {
      throw new LifiTransfersResponseError('lifi_transfers_not_array', {
        type: data.transfers == null ? String(data.transfers) : typeof data.transfers,
      });
    }
    return {
      transfers: data.transfers,
      hasNext: false,
      next: null,
      maybeTruncated: data.transfers.length >= 1000,
    };
  }

  if (!Object.prototype.hasOwnProperty.call(data, 'data')) {
    throw new LifiTransfersResponseError('lifi_transfers_missing_data');
  }
  if (!Array.isArray(data.data)) {
    throw new LifiTransfersResponseError('lifi_transfers_data_not_array', {
      type: data.data == null ? String(data.data) : typeof data.data,
    });
  }
  if (!Object.prototype.hasOwnProperty.call(data, 'hasNext') || typeof data.hasNext !== 'boolean') {
    throw new LifiTransfersResponseError('lifi_transfers_invalid_hasNext', {
      hasNext: data.hasNext,
      type: typeof data.hasNext,
    });
  }
  const hasNext = data.hasNext;
  const next = data.next == null || data.next === '' ? null : String(data.next);
  if (hasNext && !next) {
    throw new LifiTransfersResponseError('lifi_transfers_incomplete_pagination', {
      hasNext,
      next: data.next,
    });
  }
  return { transfers: data.data, hasNext, next, maybeTruncated: false };
}

export async function fetchLifiDoneTransfers({
  integrator = LIFI_INTEGRATOR,
  fromTimestamp = null,
  toTimestamp = null,
  httpGet = null,
  pageLimit = DEFAULT_PAGE_LIMIT,
} = {}) {
  const get = httpGet || ((url, config) => axios.get(url, config).then((r) => r.data));
  const all = [];
  let next = null;
  let pages = 0;

  do {
    const params = {
      integrator,
      status: 'DONE',
      limit: pageLimit,
    };
    if (fromTimestamp != null) params.fromTimestamp = fromTimestamp;
    if (toTimestamp != null) params.toTimestamp = toTimestamp;
    if (next) params.next = next;

    let raw;
    try {
      raw = await get(LIFI_TRANSFERS_V2_URL, {
        params,
        timeout: 30_000,
        headers: {
          accept: 'application/json',
          'user-agent': 'GROM-dimensions-sync/1.0',
        },
      });
    } catch (err) {
      if (err && err.isAxiosError && err.response?.data !== undefined) {
        throw new LifiTransfersResponseError('lifi_transfers_http_error', {
          status: err.response.status,
          body: err.response.data,
        });
      }
      throw err;
    }

    const parsed = parseLifiTransfersPayload(raw, { apiVersion: 'v2' });
    all.push(...parsed.transfers);
    next = parsed.hasNext ? parsed.next : null;
    pages += 1;
    if (pages > MAX_PAGES) {
      throw new LifiTransfersResponseError('lifi_transfers_too_many_pages', { pages, fetched: all.length });
    }
  } while (next);

  return all;
}

async function recordCoverageForLedgerChains({
  status,
  evidence,
  fromTimestamp,
  toTimestamp,
  recordCoverage,
  nowMs,
}) {
  const chainIds = Object.keys(CHAIN_KEY_BY_ID).map(Number);
  const failures = [];
  for (const chainId of chainIds) {
    try {
      await recordCoverage({
        source: 'lifi_analytics',
        product: 'swap',
        chainId,
        coveredFrom: new Date(fromTimestamp * 1000),
        coveredTo: new Date(toTimestamp * 1000),
        status,
        evidence,
      }, { nowMs });
    } catch (err) {
      failures.push({ chainId, error: err.message, code: err.code || null });
      logger.warn({ err: err.message, chainId, status }, 'lifi coverage write failed');
    }
  }
  return { attempted: chainIds.length, failures };
}

const COVERAGE_SCOPE_NOTE =
  'LiFi integrator=grom-exchange DONE scan only. Verified zero means no GROM Instant Swap fills via LiFi in this window — not coverage of CoWSwap/xStocks/other routers.';

/**
 * Pull LiFi DONE transfers and upsert as confirmed swap fills.
 * Idempotent via dedupe_key / fill_id.
 * Records per-chain coverage only when fromTimestamp is set.
 */
export async function syncLifiDimensionFills(opts = {}) {
  const nowMs = opts.nowMs != null ? Number(opts.nowMs) : Date.now();
  const fromTimestamp = opts.fromTimestamp != null ? Number(opts.fromTimestamp) : null;
  const toTimestamp = opts.toTimestamp != null
    ? Number(opts.toTimestamp)
    : maxCoverableToSec(nowMs);

  const doUpsert = opts.upsertFill || upsertFill;
  const doRecordCoverage = opts.recordIndexCoverage || recordIndexCoverage;
  const doFetch = opts.fetchLifiDoneTransfers || fetchLifiDoneTransfers;

  if (fromTimestamp != null) {
    assertSyncWindow({ fromTimestamp, toTimestamp, nowMs });
  }

  let transfers;
  try {
    transfers = await doFetch({
      fromTimestamp: fromTimestamp ?? undefined,
      toTimestamp: fromTimestamp != null ? toTimestamp : undefined,
      httpGet: opts.httpGet,
    });
  } catch (err) {
    if (fromTimestamp != null) {
      try {
        await recordCoverageForLedgerChains({
          status: 'failed',
          evidence: {
            error: err.message || String(err),
            code: err.code || null,
            details: err.details || null,
            scope: 'lifi_integrator_only',
          },
          fromTimestamp,
          toTimestamp,
          recordCoverage: doRecordCoverage,
          nowMs,
        });
      } catch (_) {}
    }
    throw err;
  }

  const results = {
    fetched: transfers.length,
    upserted: 0,
    skipped: 0,
    attributionFailures: [],
    errors: [],
    coverageWriteFailures: [],
    coverageRecorded: false,
    coverageStatus: null,
    fromTimestamp,
    toTimestamp: fromTimestamp != null ? toTimestamp : null,
    sourceScope: 'lifi_integrator_only',
  };

  for (const t of transfers) {
    const mapped = mapLifiTransferToFill(t);
    if (!mapped) {
      if (isGromDoneTransfer(t)) {
        results.attributionFailures.push({
          transactionId: t.transactionId || null,
          reason: 'grom_done_unmappable',
        });
      } else {
        results.skipped += 1;
      }
      continue;
    }
    try {
      await doUpsert(mapped, { trusted: true });
      results.upserted += 1;
    } catch (err) {
      results.errors.push({ tx: mapped.txHash, error: err.message });
      logger.warn({ err: err.message, tx: mapped.txHash }, 'lifi dimension upsert failed');
    }
  }

  const writeFailed = results.errors.length > 0 || results.attributionFailures.length > 0;

  if (fromTimestamp != null) {
    const status = writeFailed ? 'failed' : 'ok';
    const cov = await recordCoverageForLedgerChains({
      status,
      evidence: {
        fetched: transfers.length,
        upserted: results.upserted,
        skipped: results.skipped,
        upsertErrors: results.errors.length,
        attributionFailures: results.attributionFailures.length,
        scope: 'lifi_integrator_only',
        note: writeFailed
          ? 'Sync incomplete — window not marked covered. Safe to retry.'
          : COVERAGE_SCOPE_NOTE,
        errors: results.errors.slice(0, 20),
        attributionSample: results.attributionFailures.slice(0, 20),
      },
      fromTimestamp,
      toTimestamp,
      recordCoverage: doRecordCoverage,
      nowMs,
    });
    results.coverageWriteFailures = cov.failures;
    const coverageWriteOk = cov.failures.length === 0;
    results.coverageRecorded = coverageWriteOk;
    results.coverageStatus = coverageWriteOk ? status : 'failed';

    if (!coverageWriteOk) {
      const err = new Error('lifi_coverage_write_incomplete');
      err.code = 'lifi_coverage_write_incomplete';
      err.results = results;
      throw err;
    }
  }

  if (writeFailed) {
    const err = new Error('lifi_sync_incomplete');
    err.code = 'lifi_sync_incomplete';
    err.results = results;
    throw err;
  }

  return results;
}

export default syncLifiDimensionFills;
