import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  assertQuoteMatchesContext,
  buildQuoteContext,
  executableCacheKey,
  stripExecutableFields,
  SWAP_QUOTE_CACHE_VERSION,
} from '../src/liquidity/swap-quote-context.js';
import { parseAmountToUnits } from '../src/liquidity/swap-amount.js';

/**
 * Local stand-in for the Redis-backed proxy used only in unit tests.
 * Mirrors F01 semantics: cache key includes account+slippage+amount; informative strips calldata.
 */
function makeLocalProxy() {
  const store = new Map();
  const upstream = [];
  async function quote(body) {
    const fromAmount = parseAmountToUnits(body.amountStr, body.fromDecimals).toString();
    const ctx = buildQuoteContext({
      fromChainId: body.fromChainId,
      toChainId: body.toChainId,
      fromToken: body.fromToken,
      toToken: body.toToken,
      fromAmount,
      fromAddress: body.account,
      toAddress: body.account,
      slippage: body.slippage,
      informative: body.informative,
    });
    const key = executableCacheKey(ctx, 'test:');
    if (store.has(key)) {
      return { ...JSON.parse(store.get(key)), cached: true };
    }
    upstream.push({
      fromAddress: ctx.fromAddress,
      toAddress: ctx.toAddress,
      slippage: ctx.slippage,
      fromAmount,
    });
    let lifi = {
      action: {
        fromChainId: body.fromChainId,
        toChainId: body.toChainId,
        fromToken: { address: body.fromToken },
        toToken: { address: body.toToken },
        fromAmount,
        slippage: Number(ctx.slippage),
        fromAddress: ctx.fromAddress,
        toAddress: ctx.toAddress,
      },
      estimate: { toAmount: '100', fromAmount },
      transactionRequest: {
        from: ctx.fromAddress,
        to: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
        data: '0x' + createHash('sha256').update(ctx.toAddress + ctx.slippage).digest('hex'),
      },
    };
    assertQuoteMatchesContext({ lifi }, ctx);
    if (ctx.informative) lifi = stripExecutableFields(lifi);
    const out = { lifi, cached: false, cacheVersion: SWAP_QUOTE_CACHE_VERSION };
    store.set(key, JSON.stringify(out));
    return out;
  }
  return { quote, upstream, store };
}

describe('F01 quote isolation (local proxy semantics)', () => {
  it('two wallets with same pair/amount get distinct recipients and calldata', async () => {
    const { quote, upstream } = makeLocalProxy();
    const base = {
      fromChainId: 42161,
      toChainId: 8453,
      amountStr: '17.314167',
      fromDecimals: 6,
      fromToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      toToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    };
    const a = await quote({ ...base, account: '0x00000000000000000000000000000000000000a1', slippage: '0.005' });
    const b = await quote({ ...base, account: '0x00000000000000000000000000000000000000b2', slippage: '0.01' });
    assert.equal(upstream.length, 2);
    assert.equal(a.lifi.action.toAddress, '0x00000000000000000000000000000000000000a1');
    assert.equal(b.lifi.action.toAddress, '0x00000000000000000000000000000000000000b2');
    assert.ok(a.lifi.transactionRequest?.data);
    assert.ok(b.lifi.transactionRequest?.data);
    assert.notEqual(a.lifi.transactionRequest.data, b.lifi.transactionRequest.data);
    assert.notEqual(String(a.lifi.action.slippage), String(b.lifi.action.slippage));
  });

  it('identical context reuses cache', async () => {
    const { quote, upstream } = makeLocalProxy();
    const body = {
      fromChainId: 42161,
      toChainId: 8453,
      amountStr: '1.5',
      fromDecimals: 6,
      fromToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      toToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      account: '0x00000000000000000000000000000000000000aa',
      slippage: '0.005',
    };
    const one = await quote(body);
    const two = await quote(body);
    assert.equal(upstream.length, 1);
    assert.equal(one.cached, false);
    assert.equal(two.cached, true);
  });

  it('informative quote strips calldata; real wallet still needs own exec entry', async () => {
    const { quote, upstream } = makeLocalProxy();
    const base = {
      fromChainId: 42161,
      toChainId: 8453,
      amountStr: '2',
      fromDecimals: 6,
      fromToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      toToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      slippage: '0.005',
    };
    const info = await quote({ ...base, account: '0x0000000000000000000000000000000000000001', informative: true });
    assert.equal(info.lifi.transactionRequest, undefined);
    const exec = await quote({ ...base, account: '0x00000000000000000000000000000000000000bb' });
    assert.equal(upstream.length, 2);
    assert.ok(exec.lifi.transactionRequest?.data);
    assert.equal(exec.lifi.action.toAddress, '0x00000000000000000000000000000000000000bb');
  });

  it('rejects mismatched recipient before sign', () => {
    const ctx = buildQuoteContext({
      fromChainId: 42161, toChainId: 8453,
      fromToken: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
      toToken: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      fromAmount: '17314167',
      fromAddress: '0x0000000000000000000000000000000000000002',
      toAddress: '0x0000000000000000000000000000000000000002',
      slippage: '0.01',
    });
    assert.throws(() => assertQuoteMatchesContext({
      lifi: {
        action: {
          fromChainId: 42161, toChainId: 8453,
          fromToken: { address: ctx.fromToken },
          toToken: { address: ctx.toToken },
          fromAmount: '17314167',
          slippage: 0.01,
          fromAddress: '0x0000000000000000000000000000000000000001',
          toAddress: '0x0000000000000000000000000000000000000001',
        },
        estimate: { fromAmount: '17314167' },
        transactionRequest: { from: '0x0000000000000000000000000000000000000001', to: '0xrouter', data: '0x' },
      },
    }, ctx), /mismatch/);
  });

  it('R11: requireTx rejects quote without action', () => {
    const ctx = buildQuoteContext({
      fromChainId: 42161, toChainId: 8453,
      fromToken: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
      toToken: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      fromAmount: '17314167',
      fromAddress: '0x0000000000000000000000000000000000000002',
      toAddress: '0x0000000000000000000000000000000000000002',
      slippage: '0.005',
    });
    assert.throws(
      () => assertQuoteMatchesContext({
        lifi: { transactionRequest: { to: '0xrouter', data: '0xdead', from: ctx.fromAddress } },
      }, ctx, { requireTx: true }),
      /missing action/,
    );
  });
});
