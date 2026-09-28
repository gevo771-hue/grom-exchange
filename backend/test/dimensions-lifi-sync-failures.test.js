import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLifiTransfersPayload,
  syncLifiDimensionFills,
  LifiTransfersResponseError,
  mapLifiTransferToFill,
  LIFI_INTEGRATOR,
} from '../src/dimensions/lifi-sync.js';
import { CHAIN_KEY_BY_ID, INDEXED_FROM } from '../src/dimensions/store.js';

const fromTs = Math.floor(INDEXED_FROM.getTime() / 1000);
const toTs = fromTs + 86400;
/** Fixed clock after the sync window so completed-day guard passes. */
const nowMs = (toTs + 86400) * 1000;

const sampleDone = {
  transactionId: '0xabc',
  status: 'DONE',
  tool: 'nordstern',
  fromAddress: '0xe61e6d7bdc744b2c7d49d42c6b727c988aceac79',
  metadata: { integrator: LIFI_INTEGRATOR },
  sending: {
    txHash: '0xa3cbba397e955eb68456360e5713b7c83a2f0113cec127f5a0c5aa917ca624b9',
    chainId: 56,
    amountUSD: '3.6432',
    amount: '3644141020000000000',
    timestamp: fromTs + 100,
    token: { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, symbol: 'USDT' },
  },
  receiving: {
    txHash: '0xa3cbba397e955eb68456360e5713b7c83a2f0113cec127f5a0c5aa917ca624b9',
    chainId: 56,
    amountUSD: '3.6324',
    amount: '3634354584228528358',
    timestamp: fromTs + 100,
    token: { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, symbol: 'USDC' },
  },
  feeCosts: [],
};

describe('parseLifiTransfersPayload', () => {
  it('accepts v2 empty data array as verified-empty candidate', () => {
    const p = parseLifiTransfersPayload({ data: [], hasNext: false }, { apiVersion: 'v2' });
    assert.deepEqual(p.transfers, []);
    assert.equal(p.hasNext, false);
  });

  it('accepts v1 empty transfers array', () => {
    const p = parseLifiTransfersPayload({ transfers: [] }, { apiVersion: 'v1' });
    assert.deepEqual(p.transfers, []);
  });

  for (const [label, payload] of [
    ['{}', {}],
    ['null', null],
    ['transfers:null', { transfers: null }],
    ['transfers:{}', { transfers: {} }],
    ['data:null', { data: null }],
    ['data:{}', { data: {} }],
  ]) {
    it(`rejects malformed payload ${label}`, () => {
      assert.throws(
        () => parseLifiTransfersPayload(payload, { apiVersion: label.startsWith('data') || label === '{}' || label === 'null' ? 'v2' : 'v1' }),
        (err) => err instanceof LifiTransfersResponseError || err?.code === 'lifi_transfers_invalid'
      );
    });
  }

  it('rejects hasNext without next cursor', () => {
    assert.throws(
      () => parseLifiTransfersPayload({ data: [], hasNext: true, next: null }, { apiVersion: 'v2' }),
      /incomplete_pagination/
    );
  });

  it('rejects missing or non-boolean hasNext on v2 (not silent last page)', () => {
    assert.throws(
      () => parseLifiTransfersPayload({ data: [] }, { apiVersion: 'v2' }),
      /invalid_hasNext/
    );
    assert.throws(
      () => parseLifiTransfersPayload({ data: [], hasNext: 1 }, { apiVersion: 'v2' }),
      /invalid_hasNext/
    );
  });
});

describe('syncLifiDimensionFills failure modes', () => {
  it('malformed API → failed coverage, never ok', async () => {
    const coverage = [];
    await assert.rejects(
      () => syncLifiDimensionFills({
        fromTimestamp: fromTs,
        toTimestamp: toTs,
        nowMs,
        fetchLifiDoneTransfers: async () => {
          throw new LifiTransfersResponseError('lifi_transfers_missing_data');
        },
        recordIndexCoverage: async (row) => {
          coverage.push(row);
          return row;
        },
        upsertFill: async () => { throw new Error('should not upsert'); },
      }),
      /lifi_transfers_missing_data/
    );
    assert.ok(coverage.length >= Object.keys(CHAIN_KEY_BY_ID).length);
    assert.ok(coverage.every((c) => c.status === 'failed'));
    assert.ok(coverage.every((c) => c.status !== 'ok'));
  });

  it('valid empty transfers → ok coverage (verified zero window)', async () => {
    const coverage = [];
    const result = await syncLifiDimensionFills({
      fromTimestamp: fromTs,
      toTimestamp: toTs,
      nowMs,
      fetchLifiDoneTransfers: async () => [],
      recordIndexCoverage: async (row) => {
        coverage.push(row);
        return row;
      },
      upsertFill: async () => { throw new Error('should not upsert'); },
    });
    assert.equal(result.coverageStatus, 'ok');
    assert.equal(result.fetched, 0);
    assert.ok(coverage.every((c) => c.status === 'ok'));
    assert.match(String(coverage[0].evidence.note || coverage[0].evidence.scope), /lifi/i);
  });

  it('one upsert failure → failed coverage, not fully covered', async () => {
    const coverage = [];
    await assert.rejects(
      () => syncLifiDimensionFills({
        fromTimestamp: fromTs,
        toTimestamp: toTs,
        nowMs,
        fetchLifiDoneTransfers: async () => [sampleDone],
        upsertFill: async () => { throw new Error('db_down'); },
        recordIndexCoverage: async (row) => {
          coverage.push(row);
          return row;
        },
      }),
      (err) => err.code === 'lifi_sync_incomplete'
    );
    assert.ok(coverage.length >= 1);
    assert.ok(coverage.every((c) => c.status === 'failed'));
  });

  it('all upserts fail → failed coverage', async () => {
    const coverage = [];
    const a = { ...sampleDone, transactionId: '0x1', sending: { ...sampleDone.sending, txHash: '0x' + '1'.repeat(64) } };
    const b = { ...sampleDone, transactionId: '0x2', sending: { ...sampleDone.sending, txHash: '0x' + '2'.repeat(64) } };
    await assert.rejects(
      () => syncLifiDimensionFills({
        fromTimestamp: fromTs,
        toTimestamp: toTs,
        nowMs,
        fetchLifiDoneTransfers: async () => [a, b],
        upsertFill: async () => { throw new Error('boom'); },
        recordIndexCoverage: async (row) => {
          coverage.push(row);
          return row;
        },
      }),
      /lifi_sync_incomplete/
    );
    assert.ok(coverage.every((c) => c.status === 'failed'));
  });

  it('grom DONE unmappable transfer blocks ok coverage', async () => {
    const coverage = [];
    const bad = {
      ...sampleDone,
      sending: { ...sampleDone.sending, amountUSD: '0', txHash: '0x' + '3'.repeat(64) },
    };
    assert.equal(mapLifiTransferToFill(bad), null);
    await assert.rejects(
      () => syncLifiDimensionFills({
        fromTimestamp: fromTs,
        toTimestamp: toTs,
        nowMs,
        fetchLifiDoneTransfers: async () => [bad],
        upsertFill: async () => ({}),
        recordIndexCoverage: async (row) => {
          coverage.push(row);
          return row;
        },
      }),
      /lifi_sync_incomplete/
    );
    assert.ok(coverage.every((c) => c.status === 'failed'));
  });

  it('successful upserts → ok coverage', async () => {
    const coverage = [];
    const upserts = [];
    const result = await syncLifiDimensionFills({
      fromTimestamp: fromTs,
      toTimestamp: toTs,
      nowMs,
      fetchLifiDoneTransfers: async () => [sampleDone],
      upsertFill: async (row) => {
        upserts.push(row);
        return row;
      },
      recordIndexCoverage: async (row) => {
        coverage.push(row);
        return row;
      },
    });
    assert.equal(result.upserted, 1);
    assert.equal(result.coverageStatus, 'ok');
    assert.equal(upserts[0].status, 'confirmed');
    assert.ok(coverage.every((c) => c.status === 'ok'));
  });
});
