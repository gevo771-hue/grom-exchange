import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWalletTokens, listWalletTokens } from '../src/activity/wallet-tokens.js';

const PONS = '0x304b826a47a5e6cb2766ad9069f670651c9f847d';
const MACCA = '0x37f5dad784304ac1911b95046134c1b74e4d72a9';

test('wallet tokens: keeps valid rows, newest first, one per contract', () => {
  const rows = normalizeWalletTokens([
    { cid: '8453', addr: PONS, dec: '18', sym: 'pons' },
    { cid: '8453', addr: PONS.toUpperCase().replace('0X', '0x'), dec: '18', sym: 'PONS' },
    { cid: null, chain: '1', addr: MACCA, dec: '18', sym: 'MACCA' },
    { cid: '1', addr: '0x' + '0'.repeat(40), dec: '18', sym: 'ETH' },
    { cid: '1', addr: 'not-an-address', dec: '18', sym: 'X' },
    { cid: '56', addr: MACCA, dec: '99', sym: 'BAD' },
    { cid: '56', addr: MACCA, dec: '18', sym: '<script>' },
  ]);
  assert.deepEqual(rows, [[8453, PONS, 18, 'PONS'], [1, MACCA, 18, 'MACCA']]);
});

test('wallet tokens: bad wallet never queries, good wallet is lowercased', async () => {
  let calls = 0;
  assert.deepEqual(await listWalletTokens('nope', { q: async () => { calls++; return { rows: [] }; } }), []);
  assert.equal(calls, 0);
  let seenArgs = null;
  const out = await listWalletTokens('0xE61E6D7bdC744B2C7d49D42c6b727c988ACeAc79', {
    q: async (_sql, args) => { seenArgs = args; return { rows: [{ cid: '8453', addr: PONS, dec: '18', sym: 'PONS' }] }; },
  });
  assert.deepEqual(seenArgs, ['0xe61e6d7bdc744b2c7d49d42c6b727c988aceac79']);
  assert.deepEqual(out, [[8453, PONS, 18, 'PONS']]);
});
