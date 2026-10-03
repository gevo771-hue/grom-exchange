import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAxelarGmpStatus, normalizeAxelarGmpStatus } from '../src/market/axelar-gmp.js';
import { axelarPayload, sourceHash, destinationHash } from './fixtures/axelar-squid.js';

test('GMP executed + received requires an independent destination swap check', () => {
  const result = normalizeAxelarGmpStatus(axelarPayload(), sourceHash);
  assert.equal(result.outcome, 'destination_check');
  assert.equal(result.bridgeExecuted, true);
  assert.equal(result.sourceTxHash, sourceHash);
  assert.equal(result.destinationTxHash, destinationHash);
  assert.equal(result.destinationChainId, 42161);
  for (const status of ['approved', 'executing', 'failed', 'called']) {
    const p = axelarPayload(); p.data[0].status = status;
    assert.equal(normalizeAxelarGmpStatus(p, sourceHash).outcome, 'unknown');
  }
});

test('unmatched, missing, conflicting and ambiguous source hashes never yield delivery evidence', () => {
  const unrelated = axelarPayload();
  unrelated.data[0].call.transaction.hash = destinationHash;
  unrelated.data[0].call.transactionHash = destinationHash;
  assert.equal(normalizeAxelarGmpStatus(unrelated, sourceHash).found, false);
  const missing = axelarPayload(); delete missing.data[0].call;
  assert.equal(normalizeAxelarGmpStatus(missing, sourceHash).found, false);
  const conflict = axelarPayload(); conflict.data[0].call.transactionHash = destinationHash;
  assert.equal(normalizeAxelarGmpStatus(conflict, sourceHash).found, false);
  const multi = axelarPayload(); multi.data.push(structuredClone(multi.data[0]));
  assert.equal(normalizeAxelarGmpStatus(multi, sourceHash).found, false);
  for (const payload of [null, {}, { data: [] }, { data: {} }, { data: [{ status: 'executed', simplified_status: 'received' }] }]) {
    assert.equal(normalizeAxelarGmpStatus(payload, sourceHash).found, false);
  }
});

test('wrong router, destination, payload, source link and invalid calls cannot resolve swaps', () => {
  const mutations = [
    r => { r.executed.sourceTransactionHash = destinationHash; },
    r => { delete r.executed.transaction.hash; delete r.executed.transactionHash; },
    r => { r.executed.transaction.to = `0x${'2'.repeat(40)}`; },
    r => { delete r.call.returnValues.payloadHash; },
    r => { delete r.call.transaction.from; },
    r => { r.executed.transaction.chainId = 1; },
    r => { r.call.transaction.chainId = true; },
    r => { r.simplified_status = 'pending'; },
    r => { r.is_invalid_payload_hash = true; },
  ];
  for (const mutate of mutations) {
    const p = axelarPayload(); mutate(p.data[0]);
    assert.equal(normalizeAxelarGmpStatus(p, sourceHash).outcome, 'unknown');
  }
});

test('fixed-host fetch rejects invalid input, bounds response/time and disables redirects', async () => {
  let called = false;
  await assert.rejects(fetchAxelarGmpStatus('https://attacker.example', { get: async () => { called = true; } }), { code: 'INVALID_TX_HASH' });
  assert.equal(called, false);
  const result = await fetchAxelarGmpStatus(sourceHash, { get: async (url, options) => {
    assert.equal(url, 'https://api.axelarscan.io/gmp/searchGMP');
    assert.deepEqual(options.params, { txHash: sourceHash });
    assert.equal(options.maxRedirects, 0);
    assert.equal(options.timeout, 8000);
    assert.equal(options.maxContentLength, 1_000_000);
    return { status: 200, data: axelarPayload() };
  } });
  assert.equal(result.outcome, 'destination_check');
  await assert.rejects(fetchAxelarGmpStatus(sourceHash, { get: async () => ({ status: 503 }) }), { code: 'UPSTREAM_STATUS' });
});
