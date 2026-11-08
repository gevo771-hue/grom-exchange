import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const wallet = readFileSync(new URL('../../frontend/public/grom-wallet.js', import.meta.url), 'utf8');
const core = readFileSync(new URL('../../frontend/public/grom-swap-core.js', import.meta.url), 'utf8');
const START = '/* =========================================================================\n * Stocks section v2';
const END = 'function gwInjectXstocksWalletCss() {';
function block() {
  const a = wallet.indexOf(START), b = wallet.indexOf(END, a);
  assert.ok(a >= 0 && b > a, 'stocks v2 wallet block');
  return wallet.slice(a, b);
}
function fn(name) {
  const start = wallet.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name);
  return wallet.slice(start, wallet.indexOf('\n}', start) + 2);
}
const owner = '0x' + '1'.repeat(40);
const USDC_ETH = { chainId: 1, sym: 'USDC', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6, isNative: false };
const TSLAON = { k: 'on', s: 'TSLAon', c: 1, a: '0xf6b1117ec07684d3958cad8beb1b302bfd21103f', d: 18, p: 359 };

function harness({ kyber, lifi } = {}) {
  const calls = [];
  const ctx = vm.createContext({
    window: {}, console, Number, BigInt, Promise, URLSearchParams, Math, String, Object, Array, Error, Boolean,
    GW_LIFI_SOL_CHAIN: 1151111081099710, GW_LIFI_ZERO: '0x0000000000000000000000000000000000000000',
    GW_META_NATIVE: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', GW_META_KS_CHAIN: { 1: 'ethereum', 42161: 'arbitrum' },
    GW_OC_SWAP: { 1: { native: 'ETH', tokens: { USDC: USDC_ETH.address }, decimals: { USDC: 6 } } },
    GW_SOL_TOKENS: { SOL: 'So11111111111111111111111111111111111111112', USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' }, GW_SOL_DECIMALS: { USDC: 6 },
    GW_LIFI_ENDPOINT: 'https://li.quest/v1', GW_LIFI_INTEGRATOR: 'grom-exchange', GW_LIFI_FEE_PCT: 0.002, GW_LIFI_FEE_ADDR: '0x' + 'c'.repeat(40),
    GW_XSTOCKS_MAX_IMPACT: 0.05, _gwFeeCfg: { jupiterFeeBps: 20 },
    gwReadOnlyAddress: () => owner, gwXstocksSolPayAccount: () => '', gwXstocksSolDest: () => '', gwIsSolAddr: () => false,
    gwSwapFeeReceiver: () => '0x' + 'f'.repeat(40), gwSwapFeeBps: () => 20, gwSwapSlippageFraction: () => 0.005,
    gwAmtToBaseUnits: (amt, dec) => BigInt(Math.round(Number(amt) * 10 ** Number(dec))),
    gwLifiIsFeeConfigErr: () => false, gwLifiMarkFeeUnavailable: () => {},
    gwFetchJson: async (url) => { calls.push(['kyber', url]); return kyber(url); },
    fetch: async (url) => { calls.push(['lifi', url]); return lifi(url); },
    setTimeout, clearTimeout, AbortController,
  });
  vm.runInContext(core, ctx);
  ctx.window.GromSwapCore = ctx.GromSwapCore || ctx.window.GromSwapCore;
  vm.runInContext(fn('gwXstocksEnrichUsd') + '\n' + block(), ctx);
  return { ctx, calls };
}
const kyberOk = (outTokens, outUsd, inUsd = 200, tokenOut = TSLAON.a) => async () => ({
  ok: true, status: 200,
  json: async () => ({ data: { routerAddress: '0x' + '9'.repeat(40), routeSummary: {
    tokenIn: USDC_ETH.address, tokenOut, amountOut: String(BigInt(Math.round(outTokens * 1e6)) * 10n ** 12n),
    amountInUsd: inUsd, amountOutUsd: outUsd, gasUsd: 1.2,
  } } }),
});

test('same-network buy with any token routes through KyberSwap by contract address and passes the guard', async () => {
  const { ctx, calls } = harness({ kyber: kyberOk(0.5576, 200.2) });
  const q = await ctx.window.gwStocksQuote({ side: 'buy', token: USDC_ETH, amount: 200, variant: TSLAON, refPrice: 358.2 });
  assert.equal(q.aggregator, 'KyberSwap');
  assert.equal(q.impactBlocked, false);
  assert.ok(q.priceImpact < 0.01);
  assert.equal(calls.length, 1);
  assert.match(calls[0][1], /tokenOut=0xf6b1117ec07684d3958cad8beb1b302bfd21103f/i);
  assert.match(calls[0][1], /feeAmount=20/);
});

test('price guard blocks a thin pool that returns far less than the share value', async () => {
  const { ctx } = harness({ kyber: kyberOk(0.4, 143) });
  const q = await ctx.window.gwStocksQuote({ side: 'buy', token: USDC_ETH, amount: 200, variant: TSLAON, refPrice: 358.2 });
  assert.equal(q.impactBlocked, true);
});

test('missing independent share price fails closed', async () => {
  const { ctx } = harness({ kyber: kyberOk(0.5576, 200.2) });
  const q = await ctx.window.gwStocksQuote({ side: 'buy', token: USDC_ETH, amount: 200, variant: TSLAON, refPrice: 0 });
  assert.equal(q.impactBlocked, true);
});

test('a wrapper not priced at one share per token cannot be bought', async () => {
  const { ctx } = harness({ kyber: kyberOk(1.2, 200) });
  const q = await ctx.window.gwStocksQuote({ side: 'buy', token: USDC_ETH, amount: 200, variant: { ...TSLAON, k: 'wt', p: 150 }, refPrice: 358.2 });
  assert.equal(q.impactBlocked, true);
  assert.equal(q.impactBlockReason, 'share_ratio_unknown');
});

test('a route that would deliver a different token is rejected', async () => {
  const { ctx } = harness({ kyber: kyberOk(0.5576, 200.2, 200, '0x' + '2'.repeat(40)) });
  await assert.rejects(ctx.window.gwStocksQuote({ side: 'buy', token: USDC_ETH, amount: 200, variant: TSLAON, refPrice: 358.2 }), (e) => e.code === 'no_route');
});

test('cross-network buy blocked by the LI.FI RWA policy surfaces a clear code', async () => {
  const { ctx } = harness({
    lifi: async () => ({ ok: false, status: 404, text: async () => JSON.stringify({ message: 'No available quotes', errors: { filteredOut: [{ reason: 'Path contains RWA token(s) and integrator policy blocks RWA' }] } }) }),
  });
  const arb = { chainId: 42161, sym: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 };
  await assert.rejects(ctx.window.gwStocksQuote({ side: 'buy', token: arb, amount: 50, variant: TSLAON, refPrice: 358.2 }), (e) => e.code === 'cross_unavailable');
});

test('Solana tokens cannot pay for an EVM stock', async () => {
  const { ctx } = harness({});
  const sol = { chainId: 'solana', sym: 'USDC', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 };
  await assert.rejects(ctx.window.gwStocksQuote({ side: 'buy', token: sol, amount: 50, variant: TSLAON, refPrice: 358.2 }), (e) => e.code === 'pay_evm_required');
});

test('blocked quotes are never executed', async () => {
  const { ctx } = harness({});
  await assert.rejects(ctx.window.gwStocksExecute({ impactBlocked: true }), /price protection/);
});
