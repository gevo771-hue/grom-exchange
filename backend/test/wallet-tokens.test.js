import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWalletTokens, listWalletTokens, resolveDeliveredToken } from '../src/activity/wallet-tokens.js';

const PONS = '0x304b826a47a5e6cb2766ad9069f670651c9f847d';
const MACCA = '0x37f5dad784304ac1911b95046134c1b74e4d72a9';
const OWNER = '0xE61E6D7bdC744B2C7d49D42c6b727c988ACeAc79';
const H1 = '0x' + '1'.repeat(64);
const H2 = '0x' + '2'.repeat(64);
const H3 = '0x' + '3'.repeat(64);

test('wallet tokens: keeps valid rows, newest first, one per contract', () => {
  const rows = normalizeWalletTokens([
    { cid: '8453', addr: PONS, dec: '18', sym: 'pons' },
    { cid: '8453', addr: PONS.toUpperCase().replace('0X', '0x'), dec: '18', sym: 'PONS' },
    { cid: null, chain: '1', addr: MACCA, dec: '18', sym: 'MACCA' },
    { cid: '1', addr: '0x' + '0'.repeat(40), dec: '18', sym: 'ETH' },
    { cid: '1', addr: 'not-an-address', dec: '18', sym: 'X' },
    { cid: '1', addr: null, dec: null, sym: 'USDC' },
    { cid: '56', addr: MACCA, dec: '99', sym: 'BAD' },
    { cid: '56', addr: MACCA, dec: '18', sym: '<script>' },
  ]);
  assert.deepEqual(rows, [[8453, PONS, 18, 'PONS'], [1, MACCA, 18, 'MACCA']]);
});

test('wallet tokens: bad wallet never queries; old swaps are backfilled once from LI.FI', async () => {
  let calls = 0;
  assert.deepEqual(await listWalletTokens('nope', { q: async () => { calls++; return { rows: [] }; } }), []);
  assert.equal(calls, 0);

  const db = [
    { tx_hash: H1, created_at: '2026-11-16T00:41:00Z', detail: { to: 'PONS', toChainId: 8453 } },
    { tx_hash: H2, created_at: '2026-11-15T20:00:00Z', detail: { to: 'MACCA' } },
    { tx_hash: H3, created_at: '2026-11-16T00:59:00Z', detail: { to: 'USDC' } },
  ];
  const updates = [];
  const q = async (sql, args) => {
    if (/^\s*SELECT tx_hash/.test(sql)) {
      assert.equal(args[0], OWNER.toLowerCase());
      return { rows: db.filter((r) => !('toToken' in r.detail)).map(({ tx_hash, created_at }) => ({ tx_hash, created_at })) };
    }
    if (/^\s*UPDATE/.test(sql)) {
      updates.push(args[0]);
      const row = db.find((r) => r.tx_hash === args[0]);
      Object.assign(row.detail, JSON.parse(args[1]));
      return { rowCount: 1 };
    }
    return {
      rows: db.filter((r) => 'toToken' in r.detail)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((r) => ({ cid: r.detail.toChainId, addr: r.detail.toToken, dec: r.detail.toDec, sym: r.detail.toSym || r.detail.to })),
    };
  };
  const resolve = async (h) => {
    if (h === H1) return { cid: 8453, addr: PONS, dec: 18, sym: 'PONS' };
    if (h === H2) return { cid: 1, addr: MACCA, dec: 18, sym: 'MACCA' };
    return undefined; // still pending — not saved, asked again next time
  };
  const out = await listWalletTokens(OWNER, { q, resolve });
  assert.deepEqual(out, [[8453, PONS, 18, 'PONS'], [1, MACCA, 18, 'MACCA']]);
  assert.deepEqual(updates.sort(), [H1, H2].sort());
  assert.equal('toToken' in db[2].detail, false);
  updates.length = 0;
  await listWalletTokens(OWNER, { q, resolve });
  assert.deepEqual(updates, []);
});

test('wallet tokens: LI.FI status → delivered token, never-known, or ask later', async () => {
  const now = Date.parse('2026-11-16T01:00:00Z');
  const fresh = '2026-11-16T00:55:00Z';
  const old = '2026-11-15T20:00:00Z';
  const reply = (status, data) => async () => ({ status, data });
  const done = { status: 'DONE', receiving: { chainId: 8453, token: { address: PONS, decimals: 18, symbol: 'PONS', chainId: 8453 } } };
  assert.deepEqual(await resolveDeliveredToken(H1, { get: reply(200, done), createdAt: old, now }), { cid: 8453, addr: PONS, dec: 18, sym: 'PONS' });
  assert.equal(await resolveDeliveredToken(H1, { get: reply(200, { status: 'PENDING' }), createdAt: old, now }), undefined);
  assert.equal(await resolveDeliveredToken(H1, { get: reply(200, { status: 'NOT_FOUND' }), createdAt: fresh, now }), undefined);
  assert.equal(await resolveDeliveredToken(H1, { get: reply(200, { status: 'NOT_FOUND' }), createdAt: old, now }), null);
  assert.equal(await resolveDeliveredToken(H1, { get: reply(404, {}), createdAt: old, now }), null);
  assert.equal(await resolveDeliveredToken(H1, { get: reply(200, { status: 'FAILED' }), createdAt: old, now }), null);
  assert.equal(await resolveDeliveredToken(H1, { get: reply(429, {}), createdAt: old, now }), undefined);
  assert.equal(await resolveDeliveredToken(H1, { get: async () => { throw new Error('net'); }, createdAt: old, now }), undefined);
});

test('wallet tokens: bridge + swap reported as the bridged ETH → the delivery tx tells the real coin', async () => {
  const now = Date.parse('2026-11-16T01:00:00Z');
  const old = '2026-11-15T20:00:00Z';
  const relay = { status: 'DONE', receiving: { chainId: 1, txHash: H2, token: { address: '0x' + '0'.repeat(40), decimals: 18, symbol: 'ETH' } } };
  const get = async () => ({ status: 200, data: relay });
  let asked = null;
  const fromTx = async (cid, h, w) => { asked = [cid, h, w]; return { cid: 1, addr: MACCA, dec: 18, sym: 'Macca' }; };
  assert.deepEqual(await resolveDeliveredToken(H1, { get, createdAt: old, now, want: 'MACCA', wallet: OWNER, fromTx }), { cid: 1, addr: MACCA, dec: 18, sym: 'Macca' });
  assert.deepEqual(asked, [1, H2, OWNER]);
  /* The delivery shows some other coin → keep what LI.FI said (balance check decides). */
  const other = async () => ({ cid: 1, addr: PONS, dec: 18, sym: 'XYZ' });
  const kept = await resolveDeliveredToken(H1, { get, createdAt: old, now, want: 'MACCA', wallet: OWNER, fromTx: other });
  assert.equal(kept.sym, 'ETH');
  assert.deepEqual(normalizeWalletTokens([{ cid: kept.cid, addr: kept.addr, dec: kept.dec, sym: kept.sym }]), []);
});
