/**
 * Unit tests for GROM dimensions ledger guards (no DB required).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  queryDailyDimensions,
  coverageSnapshot,
  parentProjectMetadata,
  INDEXED_FROM,
  PRODUCTS,
  LEDGER_PRODUCTS,
  CHAIN_KEY_BY_ID,
  chainKeyForId,
  normalizeTxHash,
  intervalFullyCovered,
  upsertFill,
  SOLANA_CHAIN_ID,
} from '../src/dimensions/store.js';

describe('dimensions coverage metadata', () => {
  it('documents all four products and only swap ledger is live', () => {
    const meta = parentProjectMetadata();
    assert.equal(meta.name, 'GROM');
    assert.equal(meta.contact, 'support.grom@gmail.com');
    assert.equal(meta.telegram, 'https://t.me/grom_finence_hub');
    assert.deepEqual(
      meta.products.map((p) => p.id).sort(),
      ['perps', 'predict', 'swap', 'xstocks']
    );
    assert.deepEqual([...LEDGER_PRODUCTS], ['swap']);
  });

  it('maps known chain ids', () => {
    assert.equal(chainKeyForId(1), 'ethereum');
    assert.equal(chainKeyForId(8453), 'base');
    assert.equal(CHAIN_KEY_BY_ID[42161], 'arbitrum');
  });

  it('does not invent ready without coverage rows', () => {
    assert.equal(coverageSnapshot({ product: 'swap' }).status, 'unsynced');
    assert.equal(coverageSnapshot({ product: 'swap', ready: true }).status, 'ready');
    assert.equal(coverageSnapshot({ product: 'perps' }).status, 'unavailable');
    assert.equal(coverageSnapshot({ product: 'swap', dbOk: false }).status, 'error');
    assert.equal(coverageSnapshot({ product: 'swap', ready: true }).watermark, null);
  });
});

describe('normalizeTxHash', () => {
  it('lowercases EVM hashes', () => {
    assert.equal(normalizeTxHash(1, '0xABCDef'), '0xabcdef');
    assert.equal(normalizeTxHash(56, '0xAa'), '0xaa');
  });

  it('preserves Solana case-distinct hashes', () => {
    const mixed = '5VEJv1RUm1kNAceswYYLYT8LAsxYnEKAHLtry2jsJy8';
    assert.equal(normalizeTxHash(SOLANA_CHAIN_ID, mixed), mixed);

    const upper = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
    const lower = upper.toLowerCase();
    assert.equal(normalizeTxHash(SOLANA_CHAIN_ID, upper), upper);
    assert.equal(normalizeTxHash(SOLANA_CHAIN_ID, lower), lower);
    assert.notEqual(
      normalizeTxHash(SOLANA_CHAIN_ID, upper),
      normalizeTxHash(SOLANA_CHAIN_ID, lower)
    );
  });
});

describe('intervalFullyCovered', () => {
  it('requires full coverage of [start,end)', () => {
    const day = 86400_000;
    const t0 = Date.parse('2026-08-22T00:00:00.000Z');
    assert.equal(intervalFullyCovered([], t0, t0 + day), false);
    assert.equal(
      intervalFullyCovered([{ covered_from: new Date(t0), covered_to: new Date(t0 + day) }], t0, t0 + day),
      true
    );
    assert.equal(
      intervalFullyCovered([{ covered_from: new Date(t0), covered_to: new Date(t0 + day / 2) }], t0, t0 + day),
      false
    );
    assert.equal(
      intervalFullyCovered(
        [
          { covered_from: new Date(t0), covered_to: new Date(t0 + day / 2) },
          { covered_from: new Date(t0 + day / 2), covered_to: new Date(t0 + day) },
        ],
        t0,
        t0 + day
      ),
      true
    );
  });
});

describe('queryDailyDimensions guards (pre-DB)', () => {
  it('rejects unknown product', async () => {
    await assert.rejects(
      () => queryDailyDimensions({
        product: 'nope',
        chainId: 1,
        startTimestamp: Math.floor(INDEXED_FROM.getTime() / 1000) + 86400,
        endTimestamp: Math.floor(INDEXED_FROM.getTime() / 1000) + 172800,
      }),
      (err) => err.code === 'BAD_REQUEST' && err.status === 400
    );
  });

  it('rejects invalid range', async () => {
    await assert.rejects(
      () => queryDailyDimensions({
        product: 'swap',
        chainId: 1,
        startTimestamp: 100,
        endTimestamp: 100,
      }),
      (err) => err.code === 'BAD_REQUEST'
    );
  });

  it('returns NO_DATA for periods before indexedFrom (not silent zero)', async () => {
    await assert.rejects(
      () => queryDailyDimensions({
        product: 'swap',
        chainId: 1,
        startTimestamp: Math.floor(INDEXED_FROM.getTime() / 1000) - 86400,
        endTimestamp: Math.floor(INDEXED_FROM.getTime() / 1000) - 1,
      }),
      (err) => err.code === 'NO_DATA' && err.status === 503
    );
  });

  it('returns NO_DATA for perps/predict/xstocks without indexer', async () => {
    const start = Math.floor(INDEXED_FROM.getTime() / 1000) + 100;
    const end = start + 86400;
    await assert.rejects(
      () => queryDailyDimensions({ product: 'perps', chainId: 1, startTimestamp: start, endTimestamp: end }),
      (err) => err.code === 'NO_DATA' && /no_indexer/.test(err.message)
    );
    await assert.rejects(
      () => queryDailyDimensions({ product: 'predict', chainKey: 'ethereum', startTimestamp: start, endTimestamp: end }),
      (err) => err.code === 'NO_DATA'
    );
    await assert.rejects(
      () => queryDailyDimensions({ product: 'xstocks', chainId: 1, startTimestamp: start, endTimestamp: end }),
      (err) => err.code === 'NO_DATA'
    );
  });

  it('requires chain', async () => {
    const start = Math.floor(INDEXED_FROM.getTime() / 1000) + 100;
    await assert.rejects(
      () => queryDailyDimensions({
        product: 'swap',
        startTimestamp: start,
        endTimestamp: start + 10,
      }),
      (err) => err.code === 'BAD_REQUEST' && /chain/.test(err.message)
    );
  });

  it('returns 503 when interval has no coverage (fresh/unsynced DB)', async () => {
    const start = Math.floor(INDEXED_FROM.getTime() / 1000) + 86400;
    const end = start + 86400;
    const dbQuery = async (sql) => {
      if (/dimension_index_coverage/i.test(sql)) return { rows: [] };
      throw new Error('unexpected_sql:' + sql.slice(0, 80));
    };
    await assert.rejects(
      () => queryDailyDimensions({
        product: 'swap',
        chainId: 56,
        startTimestamp: start,
        endTimestamp: end,
        dbQuery,
      }),
      (err) => err.code === 'NO_DATA' && err.status === 503 && /interval_not_indexed/.test(err.message)
    );
  });

  it('returns verified zero when covered and no confirmed fills', async () => {
    const start = Math.floor(INDEXED_FROM.getTime() / 1000) + 86400;
    const end = start + 86400;
    const dbQuery = async (sql) => {
      if (/dimension_index_coverage/i.test(sql)) {
        return {
          rows: [{
            covered_from: new Date(start * 1000),
            covered_to: new Date(end * 1000),
            status: 'ok',
          }],
        };
      }
      if (/FROM dimension_fills/i.test(sql)) {
        return { rows: [{ volume_usd: '0', fee_usd: '0', fill_count: 0 }] };
      }
      throw new Error('unexpected_sql:' + sql.slice(0, 80));
    };
    const result = await queryDailyDimensions({
      product: 'swap',
      chainId: 1,
      startTimestamp: start,
      endTimestamp: end,
      dbQuery,
    });
    assert.equal(result.ok, true);
    assert.equal(result.dailyVolumeUsd, 0);
    assert.equal(result.dailyFeesUsd, 0);
    assert.equal(result.coverage.status, 'ready');
  });

  it('returns 503 when storage is unavailable', async () => {
    const start = Math.floor(INDEXED_FROM.getTime() / 1000) + 86400;
    const end = start + 86400;
    const dbQuery = async () => {
      throw new Error('ECONNREFUSED');
    };
    await assert.rejects(
      () => queryDailyDimensions({
        product: 'swap',
        chainId: 1,
        startTimestamp: start,
        endTimestamp: end,
        dbQuery,
      }),
      (err) => err.code === 'UPSTREAM_ERROR' && err.status === 503
    );
  });
});

describe('upsertFill confirmed protection (mock DB)', () => {
  it('untrusted client cannot change confirmed identity/evidence', async () => {
    const confirmed = {
      id: 7,
      status: 'confirmed',
      product: 'swap',
      fill_id: 'lifi:abc',
      router: 'lifi',
      attribution: 'lifi:grom-exchange',
      volume_usd: '7.3',
      fee_usd: '0',
      evidence: { source: 'lifi_analytics' },
      tx_hash: '0xabc',
      chain_id: 56,
      dedupe_key: '56:0xabc:-1',
    };
    let wrote = false;
    const dbQuery = async (sql, params) => {
      if (/SELECT id, status/i.test(sql) && /dedupe_key/i.test(sql)) {
        return { rows: [confirmed] };
      }
      wrote = true;
      throw new Error('should_not_write:' + sql.slice(0, 40));
    };
    const row = await upsertFill({
      product: 'perps',
      chainId: 56,
      txHash: '0xAbC',
      attribution: 'attacker',
      volumeUsd: 999,
      feeUsd: 1,
      status: 'reported',
      evidence: { source: 'client_report', evil: true },
    }, { trusted: false, dbQuery });

    assert.equal(wrote, false);
    assert.equal(row.status, 'confirmed');
    assert.equal(row.product, 'swap');
    assert.equal(row.attribution, 'lifi:grom-exchange');
    assert.deepEqual(row.evidence, { source: 'lifi_analytics' });
    assert.equal(row.volume_usd, '7.3');
  });

  it('Solana case is preserved in stored tx hash on insert', async () => {
    const solHash = '5VEJv1RUm1kNAceswYYLYT8LAsxYnEKAHLtry2jsJy8';
    let insertedHash = null;
    const dbQuery = async (sql, params) => {
      if (/SELECT id, status/i.test(sql)) return { rows: [] };
      if (/INSERT INTO dimension_fills/i.test(sql)) {
        insertedHash = params[4];
        return {
          rows: [{
            id: 1,
            status: 'reported',
            product: 'swap',
            tx_hash: params[4],
            chain_id: SOLANA_CHAIN_ID,
            dedupe_key: params[0],
          }],
        };
      }
      throw new Error('unexpected');
    };
    await upsertFill({
      product: 'swap',
      chainId: SOLANA_CHAIN_ID,
      txHash: solHash,
      volumeUsd: 1,
      status: 'reported',
    }, { trusted: false, dbQuery });
    assert.equal(insertedHash, solHash);
    assert.match(String(insertedHash), /[A-Z]/);
  });
});
