import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const wallet = readFileSync(new URL('../../frontend/public/grom-wallet.js', import.meta.url), 'utf8');
function source(name) {
  const start = wallet.indexOf('async function ' + name + '(');
  assert.ok(start >= 0);
  return wallet.slice(start, wallet.indexOf('\n}', start) + 2);
}
const request = { chainId: 42161, fromSym: 'USDC', toSym: 'AALX', amtNum: 2,
  account: 'payment-owner', address: 'arb-stock', decimals: 18, tokenSym: 'AALX' };
function evmHarness(quotes) {
  const calls = [];
  const ctx = vm.createContext({
    window: { __gwDsForceBridgeTo: { chainId: 137 }, gwXstocksRegisterToken() {} },
    gwMetaAggQuoteBest() { throw new Error('General swap router must not be used'); },
    async gwMetaAggQuoteAll(params) { calls.push(params); return quotes; },
  });
  vm.runInContext(source('gwXstocksQuoteEvmOnChain'), ctx);
  return { ctx, calls };
}
test('stock EVM leg pins both chains and preserves its payment owner, independent of swap selection', async () => {
  const { ctx, calls } = evmHarness([{ toAmount: 1n, outDecimals: 8 }]);
  const q = await ctx.gwXstocksQuoteEvmOnChain(request);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].chainId, 42161);
  assert.equal(calls[0].toChainId, 42161);
  assert.equal(calls[0].account, 'payment-owner');
  assert.equal(q.venue, 'evm');
  assert.equal(q._execChainId, 42161);
  assert.equal(q.outDecimals, 8);
});
test('stock EVM leg rejects a better-ranked quote for another network', async () => {
  const wrong = [
    { toAmount: 100n, _crossChain: true },
    { toAmount: 99n, _toChainId: 137 },
    { toAmount: 98n, _fromChainId: 1 },
  ];
  const valid = { toAmount: 1n, _fromChainId: 42161, _toChainId: 42161 };
  const { ctx } = evmHarness([...wrong, valid]);
  assert.equal((await ctx.gwXstocksQuoteEvmOnChain(request)).toAmount, 1n);
  const empty = evmHarness(wrong);
  assert.equal(await empty.ctx.gwXstocksQuoteEvmOnChain(request), null);
});
function bridgeHarness(fetcher) {
  let expire, cleared = false, signal, timeoutMs;
  const ctx = vm.createContext({
    URLSearchParams, AbortController, console: { warn() {} },
    GW_OC_SWAP: { 42161: { tokens: { USDC: 'usdc' }, decimals: { USDC: 6 } } },
    GW_LIFI_SOL_CHAIN: 1151111081099710, GW_LIFI_ENDPOINT: 'https://li.quest/v1',
    GW_LIFI_INTEGRATOR: 'grom-exchange', GW_LIFI_FEE_ADDR: 'fee-wallet', GW_LIFI_FEE_PCT: .002,
    gwAmtToBaseUnits: () => 2000000n, gwSwapFeeBps: () => 20,
    gwLifiIsFeeConfigErr: () => false,
    setTimeout(cb, ms) { expire = cb; timeoutMs = ms; return 1; },
    clearTimeout(id) { assert.equal(id, 1); cleared = true; },
    fetch(url, opts) { signal = opts.signal; return fetcher(url, opts); },
  });
  vm.runInContext(source('gwXstocksQuoteLifiToSol'), ctx);
  return { run: () => ctx.gwXstocksQuoteLifiToSol({ ...request, solMint: 'stock-mint', solAddr: 'recipient', solDecimals: 8 }),
    expire: () => expire(), get cleared() { return cleared; }, get timeoutMs() { return timeoutMs; }, get signal() { return signal; } };
}
test('an unresponsive Solana bridge quote aborts after 12 seconds and settles without a transaction', async () => {
  const h = bridgeHarness((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }));
  const pending = h.run();
  assert.equal(h.timeoutMs, 12000);
  h.expire();
  assert.equal(await pending, null);
  assert.equal(h.signal.aborted, true);
  assert.equal(h.cleared, true);
});
test('a completed bridge quote clears its timer and keeps source, recipient and fee parameters', async () => {
  const h = bridgeHarness(async url => {
    const p = new URL(url).searchParams;
    assert.equal(p.get('fromAddress'), 'payment-owner');
    assert.equal(p.get('toAddress'), 'recipient');
    assert.equal(p.get('fee'), '0.002');
    return { ok: true, json: async () => ({ estimate: { toAmount: '10000000' }, transactionRequest: { to: 'router', data: '0x' } }) };
  });
  assert.equal((await h.run()).toAmount, 10000000n);
  assert.equal(h.cleared, true);
  assert.equal(h.signal.aborted, false);
});
test('a rejected bridge quote releases its timer and remains unavailable', async () => {
  const h = bridgeHarness(async () => ({ ok: false, status: 404, text: async () => 'No available quotes' }));
  assert.equal(await h.run(), null);
  assert.equal(h.cleared, true);
});
