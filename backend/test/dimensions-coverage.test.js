/**
 * Coverage / trust regression tests for the dimensions ledger.
 * DB is stubbed via the dbQuery injection point — no Postgres required.
 *
 * Contract under test (DefiLlama review 2026-09-14):
 *  - unsynced interval → 503, never verified zero
 *  - scanned empty interval → 200 zero
 *  - failed sync window → 503
 *  - covered confirmed fill counted once on its own chain
 *  - untrusted client report cannot mutate a confirmed fill
 *  - Solana tx hash case is preserved
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  queryDailyDimensions,
  upsertFill,
  intervalFullyCovered,
  normalizeTxHash,
  buildMetaPayload,
  INDEXED_FROM,
  SOLANA_CHAIN_ID,
} from '../src/dimensions/store.js';

const DAY = 86400;
const START = Math.floor(INDEXED_FROM.getTime() / 1000) + DAY;
const END = START + DAY;

function isoRange(startSec, endSec) {
  return {
    covered_from: new Date(startSec * 1000).toISOString(),
    covered_to: new Date(endSec * 1000).toISOString(),
  };
}

/** Minimal SQL-shape router so tests stay readable. */
function makeDb({ coverage = [], sums = null, existingFill = null } = {}) {
  const calls = [];
  const dbQuery = async (sql, params = []) => {
    calls.push({ sql, params });
    if (/FROM dimension_index_coverage/.test(sql) && /GROUP BY/.test(sql)) {
      return { rows: coverage.map((c) => ({ ...c, windows: 1, first_from: c.covered_from, watermark: c.covered_to })) };
    }
    if (/FROM dimension_index_coverage/.test(sql)) {
      return { rows: coverage.filter((c) => (c.status || 'ok') === 'ok') };
    }
    if (/FROM dimension_fills WHERE dedupe_key/.test(sql)) {
      return { rows: existingFill ? [existingFill] : [] };
    }
    if (/SUM\(volume_usd\)/.test(sql)) {
      return {
        rows: [sums || { volume_usd: '0', fee_usd: '0', fill_count: 0 }],
      };
    }
    if (/INSERT INTO dimension_fills/.test(sql)) {
      return { rows: [{ id: 1, status: params[18], tx_hash: params[4], dedupe_key: params[0] }] };
    }
    if (/INSERT INTO dimension_index_coverage/.test(sql)) {
      return { rows: [{ id: 1, status: 'ok' }] };
    }
    return { rows: [] };
  };
  return { dbQuery, calls };
}

describe('intervalFullyCovered', () => {
  it('requires the whole requested window', () => {
    const covered = [isoRange(START, START + 3600)];
    assert.equal(intervalFullyCovered(covered, START * 1000, END * 1000), false);
    assert.equal(intervalFullyCovered(covered, START * 1000, (START + 3600) * 1000), true);
  });

  it('joins adjacent windows but not gaps', () => {
    const adjacent = [isoRange(START, START + 3600), isoRange(START + 3600, END)];
    assert.equal(intervalFullyCovered(adjacent, START * 1000, END * 1000), true);
    const gapped = [isoRange(START, START + 3600), isoRange(START + 7200, END)];
    assert.equal(intervalFullyCovered(gapped, START * 1000, END * 1000), false);
  });

  it('treats empty coverage as not covered', () => {
    assert.equal(intervalFullyCovered([], START * 1000, END * 1000), false);
  });
});

describe('queryDailyDimensions coverage gate', () => {
  it('fresh database / unsynced interval → 503 NO_DATA (not zero)', async () => {
    const { dbQuery } = makeDb({ coverage: [] });
    await assert.rejects(
      () => queryDailyDimensions({
        product: 'swap',
        chainId: 56,
        startTimestamp: START,
        endTimestamp: END,
        dbQuery,
      }),
      (err) => err.code === 'NO_DATA'
        && err.status === 503
        && err.coverage.status === 'unsynced'
    );
  });

  it('failed sync window does not count as coverage → 503', async () => {
    const { dbQuery } = makeDb({
      coverage: [{ ...isoRange(START, END), status: 'failed', product: 'swap', chain_id: 56 }],
    });
    await assert.rejects(
      () => queryDailyDimensions({
        product: 'swap',
        chainId: 56,
        startTimestamp: START,
        endTimestamp: END,
        dbQuery,
      }),
      (err) => err.code === 'NO_DATA' && err.status === 503
    );
  });

  it('scanned empty interval → 200 verified zero', async () => {
    const { dbQuery } = makeDb({
      coverage: [{ ...isoRange(START, END), status: 'ok', product: 'swap', chain_id: 56 }],
    });
    const res = await queryDailyDimensions({
      product: 'swap',
      chainKey: 'bsc',
      startTimestamp: START,
      endTimestamp: END,
      dbQuery,
    });
    assert.equal(res.ok, true);
    assert.equal(res.dailyVolumeUsd, 0);
    assert.equal(res.dailyFeesUsd, 0);
    assert.equal(res.fillCount, 0);
    assert.equal(res.coverage.status, 'ready');
    assert.equal(res.coverage.watermark, new Date(END * 1000).toISOString());
  });

  it('covered confirmed fill is counted once on its own chain', async () => {
    const { dbQuery } = makeDb({
      coverage: [{ ...isoRange(START, END), status: 'ok', product: 'swap', chain_id: 56 }],
      sums: { volume_usd: '3.6432', fee_usd: '0', fill_count: 1 },
    });
    const res = await queryDailyDimensions({
      product: 'swap',
      chainId: 56,
      startTimestamp: START,
      endTimestamp: END,
      dbQuery,
    });
    assert.equal(res.dailyVolumeUsd, 3.6432);
    assert.equal(res.fillCount, 1);
    assert.equal(res.chainKey, 'bsc');
  });

  it('store failure → 503 UPSTREAM_ERROR, never zero', async () => {
    const dbQuery = async () => { throw new Error('connection terminated'); };
    await assert.rejects(
      () => queryDailyDimensions({
        product: 'swap',
        chainId: 56,
        startTimestamp: START,
        endTimestamp: END,
        dbQuery,
      }),
      (err) => err.status === 503 && err.coverage.status === 'error'
    );
  });

  it('perps / predict without indexer → 503 regardless of coverage rows', async () => {
    const { dbQuery } = makeDb({
      coverage: [{ ...isoRange(START, END), status: 'ok', product: 'perps', chain_id: 42161 }],
    });
    for (const product of ['perps', 'predict', 'xstocks']) {
      await assert.rejects(
        () => queryDailyDimensions({
          product,
          chainId: 42161,
          startTimestamp: START,
          endTimestamp: END,
          dbQuery,
        }),
        (err) => err.code === 'NO_DATA' && err.status === 503
      );
    }
  });
});

describe('buildMetaPayload readiness', () => {
  it('reports unsynced when no coverage rows exist', async () => {
    const { dbQuery } = makeDb({ coverage: [] });
    const meta = await buildMetaPayload({ dbQuery });
    assert.equal(meta.coverageByProduct.swap.status, 'unsynced');
    assert.equal(meta.coverageByProduct.swap.watermark, null);
    assert.deepEqual(meta.chainsCovered.swap, {});
    assert.equal(meta.parent.telegram, 'https://t.me/grom_finence_hub');
  });

  it('reports ready per chain only where coverage exists', async () => {
    const { dbQuery } = makeDb({
      coverage: [{ ...isoRange(START, END), status: 'ok', product: 'swap', chain_id: 56 }],
    });
    const meta = await buildMetaPayload({ dbQuery });
    assert.equal(meta.coverageByProduct.swap.status, 'ready');
    assert.deepEqual(Object.keys(meta.chainsCovered.swap), ['bsc']);
    assert.equal(meta.coverageByProduct.perps.status, 'unavailable');
  });

  it('propagates DB failure as 503', async () => {
    const dbQuery = async () => { throw new Error('db down'); };
    await assert.rejects(() => buildMetaPayload({ dbQuery }), (err) => err.status === 503);
  });
});

describe('upsertFill trust boundary', () => {
  it('client report cannot change a confirmed fill identity or evidence', async () => {
    const confirmed = {
      id: 7,
      status: 'confirmed',
      product: 'swap',
      attribution: 'lifi:grom-exchange',
      volume_usd: '3.6432',
      fee_usd: '0',
      evidence: { source: 'lifi_analytics' },
      tx_hash: '0xa3cb',
      chain_id: 56,
      dedupe_key: '56:0xa3cb:-1',
    };
    const { dbQuery, calls } = makeDb({ existingFill: confirmed });
    const row = await upsertFill({
      product: 'perps',
      chainId: 56,
      txHash: '0xA3CB',
      volumeUsd: 999999,
      feeUsd: 999,
      attribution: 'client_report',
      status: 'confirmed',
      evidence: { spoof: true },
    }, { trusted: false, dbQuery });

    assert.equal(row.status, 'confirmed');
    assert.equal(row.product, 'swap');
    assert.equal(row.volume_usd, '3.6432');
    assert.equal(row.attribution, 'lifi:grom-exchange');
    assert.equal(calls.some((c) => /INSERT INTO dimension_fills/.test(c.sql)), false);
  });

  it('untrusted report can never insert status=confirmed', async () => {
    const { dbQuery, calls } = makeDb({ existingFill: null });
    await upsertFill({
      product: 'swap',
      chainId: 56,
      txHash: '0xdeadbeef',
      volumeUsd: 100,
      status: 'confirmed',
    }, { trusted: false, dbQuery });
    const insert = calls.find((c) => /INSERT INTO dimension_fills/.test(c.sql));
    assert.ok(insert);
    assert.equal(insert.params[18], 'reported');
    assert.match(insert.sql, /WHERE dimension_fills\.status IS DISTINCT FROM 'confirmed'/);
  });

  it('trusted indexer path may write confirmed', async () => {
    const { dbQuery, calls } = makeDb({ existingFill: null });
    await upsertFill({
      product: 'swap',
      chainId: 56,
      txHash: '0xdeadbeef',
      volumeUsd: 100,
      status: 'confirmed',
    }, { trusted: true, dbQuery });
    const insert = calls.find((c) => /INSERT INTO dimension_fills/.test(c.sql));
    assert.equal(insert.params[18], 'confirmed');
  });
});

describe('chain-specific hash normalization', () => {
  it('lowercases EVM hashes and preserves Solana signatures', () => {
    assert.equal(normalizeTxHash(56, '0xA3CB'), '0xa3cb');
    const sig = '5Kd3NBUAdUnhyzymPzbD3tGAUVwrMyfAXBQvzvbV9uL8';
    assert.equal(normalizeTxHash(SOLANA_CHAIN_ID, sig), sig);
  });

  it('keeps case-distinct Solana signatures as separate fills', async () => {
    const sigA = '5Kd3NBUAdUnhyzymPzbD3tGAUVwrMyfAXBQvzvbV9uL8';
    const sigB = sigA.toLowerCase();
    const keys = [];
    for (const sig of [sigA, sigB]) {
      const { dbQuery, calls } = makeDb({ existingFill: null });
      await upsertFill({
        product: 'swap',
        chainId: SOLANA_CHAIN_ID,
        txHash: sig,
        volumeUsd: 10,
        status: 'confirmed',
      }, { trusted: true, dbQuery });
      const insert = calls.find((c) => /INSERT INTO dimension_fills/.test(c.sql));
      assert.equal(insert.params[4], sig);
      keys.push(insert.params[0]);
    }
    assert.notEqual(keys[0], keys[1]);
  });

  it('preserves Solana wallet case, lowercases EVM wallet', async () => {
    const wallet = 'So11111111111111111111111111111111111111112';
    const { dbQuery, calls } = makeDb({ existingFill: null });
    await upsertFill({
      product: 'swap',
      chainId: SOLANA_CHAIN_ID,
      txHash: 'Sig123AbC',
      volumeUsd: 1,
      status: 'confirmed',
      wallet,
    }, { trusted: true, dbQuery });
    const insert = calls.find((c) => /INSERT INTO dimension_fills/.test(c.sql));
    assert.equal(insert.params[20], wallet);
  });
});
