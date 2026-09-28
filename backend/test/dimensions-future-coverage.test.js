/**
 * Fixed-clock tests: future coverage must never be ready / recordable as ok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  queryDailyDimensions,
  intervalFullyCovered,
  recordIndexCoverage,
  maxCoverableToSec,
  utcDayStartSec,
  clipWatermarkMs,
  INDEXED_FROM,
} from '../src/dimensions/store.js';
import {
  assertSyncWindow,
  parseLifiTransfersPayload,
  syncLifiDimensionFills,
  LifiTransfersResponseError,
} from '../src/dimensions/lifi-sync.js';

/** Fixed "now": 2026-09-14T18:30:00.000Z */
const NOW_MS = Date.parse('2026-09-14T18:30:00.000Z');
const SOD = utcDayStartSec(NOW_MS); // 2026-09-14T00:00:00Z
const SEP14 = SOD;
const SEP15 = SOD + 86400;
const AUG22 = Math.floor(INDEXED_FROM.getTime() / 1000);

function isoRange(startSec, endSec) {
  return {
    covered_from: new Date(startSec * 1000).toISOString(),
    covered_to: new Date(endSec * 1000).toISOString(),
  };
}

function makeDb({ coverage = [] } = {}) {
  const dbQuery = async (sql) => {
    if (/FROM dimension_index_coverage/.test(sql) && !/INSERT/.test(sql) && !/UPDATE/.test(sql)) {
      return { rows: coverage.filter((c) => (c.status || 'ok') === 'ok') };
    }
    if (/SUM\(volume_usd\)/.test(sql)) {
      return { rows: [{ volume_usd: '0', fee_usd: '0', fill_count: 0 }] };
    }
    if (/INSERT INTO dimension_index_coverage/.test(sql)) {
      return { rows: [{ id: 1, status: 'ok' }] };
    }
    return { rows: [] };
  };
  return { dbQuery };
}

describe('future coverage guards (fixed clock 2026-09-14T18:30Z)', () => {
  it('maxCoverableToSec is start of current UTC day', () => {
    assert.equal(maxCoverableToSec(NOW_MS), SEP14);
    assert.equal(new Date(maxCoverableToSec(NOW_MS) * 1000).toISOString(), '2026-09-14T00:00:00.000Z');
  });

  it('assertSyncWindow rejects future --to', () => {
    assert.throws(
      () => assertSyncWindow({ fromTimestamp: AUG22, toTimestamp: SEP15, nowMs: NOW_MS }),
      (err) => err.code === 'sync_to_beyond_completed_utc_day'
        || err.code === 'sync_to_in_future'
    );
  });

  it('assertSyncWindow rejects toTimestamp after now', () => {
    const laterToday = Math.floor(NOW_MS / 1000) + 3600;
    assert.throws(
      () => assertSyncWindow({ fromTimestamp: AUG22, toTimestamp: laterToday, nowMs: NOW_MS }),
      (err) => err.code === 'sync_to_in_future'
    );
  });

  it('assertSyncWindow accepts completed UTC days only', () => {
    const w = assertSyncWindow({ fromTimestamp: AUG22, toTimestamp: SEP14, nowMs: NOW_MS });
    assert.equal(w.toTimestamp, SEP14);
  });

  it('interval with future end → not covered even if DB claims Sep15', () => {
    const fake = [isoRange(AUG22, SEP15)];
    assert.equal(
      intervalFullyCovered(fake, SEP14 * 1000, SEP15 * 1000, { nowMs: NOW_MS }),
      false
    );
  });

  it('query for in-progress UTC day → 503 even with fraudulent future coverage row', async () => {
    const { dbQuery } = makeDb({
      coverage: [{ ...isoRange(AUG22, SEP15), status: 'ok', product: 'swap', chain_id: 1 }],
    });
    await assert.rejects(
      () => queryDailyDimensions({
        product: 'swap',
        chainKey: 'ethereum',
        startTimestamp: SEP14,
        endTimestamp: SEP15,
        dbQuery,
        nowMs: NOW_MS,
      }),
      (err) => err.status === 503
        && err.code === 'NO_DATA'
        && (err.message === 'interval_extends_into_future' || err.message === 'interval_not_indexed')
    );
  });

  it('completed scanned empty day → 200 / verified zero', async () => {
    const dayStart = SEP14 - 86400; // Sep 13
    const dayEnd = SEP14;
    const { dbQuery } = makeDb({
      coverage: [{ ...isoRange(AUG22, SEP14), status: 'ok', product: 'swap', chain_id: 1 }],
    });
    const res = await queryDailyDimensions({
      product: 'swap',
      chainKey: 'ethereum',
      startTimestamp: dayStart,
      endTimestamp: dayEnd,
      dbQuery,
      nowMs: NOW_MS,
    });
    assert.equal(res.ok, true);
    assert.equal(res.dailyVolumeUsd, 0);
    assert.equal(res.coverage.status, 'ready');
  });

  it('old false future window does not satisfy in-progress day after clip', async () => {
    // covered_to clipped at now (18:30) still cannot cover full Sep14→Sep15
    const fake = [isoRange(AUG22, SEP15)];
    assert.equal(
      intervalFullyCovered(fake, SEP14 * 1000, SEP15 * 1000, { nowMs: NOW_MS }),
      false
    );
    // But completed prefix of Sep14 up to now could be covered by clip — we still
    // refuse full-day requests via end > now in queryDailyDimensions.
    assert.equal(
      intervalFullyCovered(fake, SEP14 * 1000, Math.floor(NOW_MS / 1000) * 1000, { nowMs: NOW_MS }),
      true
    );
  });

  it('recordIndexCoverage(ok) rejects covered_to in the future', async () => {
    const { dbQuery } = makeDb();
    await assert.rejects(
      () => recordIndexCoverage({
        source: 'lifi_analytics',
        product: 'swap',
        chainId: 1,
        coveredFrom: new Date(AUG22 * 1000),
        coveredTo: new Date(SEP15 * 1000),
        status: 'ok',
      }, { dbQuery, nowMs: NOW_MS }),
      (err) => err.code === 'coverage_to_in_future'
    );
  });

  it('clipWatermarkMs never returns past start-of-today / now', () => {
    const clipped = clipWatermarkMs(SEP15 * 1000, NOW_MS);
    assert.ok(clipped <= SEP14 * 1000);
    assert.ok(clipped <= NOW_MS);
  });
});

describe('parseLifiTransfersPayload pagination contract', () => {
  it('requires boolean hasNext on v2', () => {
    assert.throws(
      () => parseLifiTransfersPayload({ data: [] }, { apiVersion: 'v2' }),
      (err) => err instanceof LifiTransfersResponseError
        && /invalid_hasNext/.test(err.message)
    );
    assert.throws(
      () => parseLifiTransfersPayload({ data: [], hasNext: 'yes' }, { apiVersion: 'v2' }),
      /invalid_hasNext/
    );
  });

  it('accepts hasNext false with empty data', () => {
    const p = parseLifiTransfersPayload({ data: [], hasNext: false }, { apiVersion: 'v2' });
    assert.deepEqual(p.transfers, []);
    assert.equal(p.hasNext, false);
  });
});

describe('syncLifiDimensionFills future window', () => {
  it('future --to is rejected before fetch', async () => {
    let fetched = false;
    await assert.rejects(
      () => syncLifiDimensionFills({
        fromTimestamp: AUG22,
        toTimestamp: SEP15,
        nowMs: NOW_MS,
        fetchLifiDoneTransfers: async () => { fetched = true; return []; },
        upsertFill: async () => ({}),
        recordIndexCoverage: async () => ({}),
      }),
      (err) => err.code === 'sync_to_beyond_completed_utc_day' || err.code === 'sync_to_in_future'
    );
    assert.equal(fetched, false);
  });

  it('coverage write failure → incomplete (not coverageRecorded true)', async () => {
    await assert.rejects(
      () => syncLifiDimensionFills({
        fromTimestamp: AUG22,
        toTimestamp: SEP14,
        nowMs: NOW_MS,
        fetchLifiDoneTransfers: async () => [],
        upsertFill: async () => ({}),
        recordIndexCoverage: async () => { throw new Error('db_write_fail'); },
      }),
      (err) => err.code === 'lifi_coverage_write_incomplete'
        && err.results
        && err.results.coverageRecorded === false
    );
  });
});
