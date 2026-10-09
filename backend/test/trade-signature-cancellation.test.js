import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../frontend/public/grom-hyperliquid.js', import.meta.url), 'utf8');
function fn(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return (source.slice(start - 6, start) === 'async ' ? 'async ' : '')
    + source.slice(start, source.indexOf('\n  }', start) + 4);
}

// Exercise the production signing fallback and action wrapper with fake SDKs.
// No wallet, relay, signature or exchange request leaves this process.
function harness({ originalError, v4Error, legacyError } = {}) {
  const calls = [], reconnects = [];
  const provider = { request: async ({ method }) => {
    calls.push(method);
    const error = method === 'eth_signTypedData_v4' ? v4Error : legacyError;
    if (error) throw error;
    return 'test-signature';
  } };
  const wallet = { signTypedData: async () => {
    calls.push('ethers');
    if (originalError) throw originalError;
    return 'test-signature';
  } };
  const ctx = vm.createContext({ window: { gwEnsureSigningForSwap: async args => reconnects.push(args) },
    console, setTimeout() {}, eth: () => provider, wcSessionHasTypedData: () => true,
    wcSessionHasHlL1: () => true, getAddress: async () => '0x' + '1'.repeat(40),
    proxyTransport: () => ({}), toast() {}, hlWalletLabel: () => 'Trust',
    loadSdk: async () => ({ ExchangeClient: class { constructor(opts) { this.wallet = opts.wallet; } } }),
    ethersStub: { BrowserProvider: class { async getSigner() { return wallet; } },
      TypedDataEncoder: { getPayload: () => ({ domain: { chainId: 1337n }, types: {}, message: {} }) },
    },
  });
  const exchange = fn('getExchangeClient').replace(
    "await import(/* webpackIgnore: true */ 'https://esm.sh/ethers@6.13.4')", 'ethersStub');
  assert.doesNotMatch(exchange, /await import/);
  vm.runInContext(['isHlSignatureCancelled', 'isHlSignRetriable', 'humanizeHlSignError', 'hlSignedAction'].map(fn).join('\n') + '\n' + exchange, ctx);
  return { calls, reconnects, ctx, async sign() {
    const client = await ctx.getExchangeClient();
    return client.wallet.signTypedData({}, {}, {});
  } };
}

test('cancelling the initial Trade signature never opens a fallback request', async () => {
  for (const error of [Object.assign(new Error('Denied'), { code: 4001 }),
    Object.assign(new Error('Request failed'), { code: 'ACTION_REJECTED' }),
    new Error('User rejected the request'), new Error('Cancelled by user')]) {
    const h = harness({ originalError: error });
    await assert.rejects(h.sign(), e => e === error);
    assert.deepEqual(h.calls, ['ethers']);
  }
});

test('cancelling the v4 fallback never falls through to legacy signing', async () => {
  const cancelled = Object.assign(new Error('Denied'), { code: 4001 });
  const h = harness({ originalError: new Error('Unsupported wallet method'), v4Error: cancelled });
  await assert.rejects(h.sign(), e => e === cancelled);
  assert.deepEqual(h.calls, ['ethers', 'eth_signTypedData_v4']);
});

test('legacy cancellation preserves the rejection instead of resurrecting an earlier retryable error', async () => {
  const cancelled = Object.assign(new Error('Denied'), { code: 4001 });
  const h = harness({ originalError: new Error('Unsupported wallet method'),
    v4Error: new Error('Unknown method'), legacyError: cancelled });
  await assert.rejects(h.ctx.hlSignedAction(() => h.sign()), /Signature cancelled in Trust/);
  assert.deepEqual(h.calls, ['ethers', 'eth_signTypedData_v4', 'eth_signTypedData']);
  assert.equal(h.reconnects.length, 0);
});

test('nested provider cancellations do not force reconnect or replay a Trade action', async () => {
  for (const nested of [{ error: { code: 4001 } }, { info: { error: { code: 4001 } } },
    { cause: { code: 'ACTION_REJECTED' } }, { data: { originalError: { code: 4001 } } }]) {
    const error = Object.assign(new Error('could not coalesce error'), nested);
    const h = harness({ originalError: error });
    await assert.rejects(h.ctx.hlSignedAction(() => h.sign()), /Signature cancelled in Trust/);
    assert.deepEqual(h.calls, ['ethers']);
    assert.equal(h.reconnects.length, 0);
  }
});

test('supported native signing and legitimate compatibility fallbacks still return the signature', async () => {
  for (const [opts, expected] of [[{}, ['ethers']],
    [{ originalError: new Error('Unsupported wallet method') }, ['ethers', 'eth_signTypedData_v4']],
    [{ originalError: new Error('Unsupported wallet method'), v4Error: new Error('Unknown method') }, ['ethers', 'eth_signTypedData_v4', 'eth_signTypedData']]]) {
    const h = harness(opts);
    assert.equal(await h.sign(), 'test-signature');
    assert.deepEqual(h.calls, expected);
  }
});

test('cyclic error wrappers terminate without treating an unrelated error as a cancellation', () => {
  const h = harness();
  const error = new Error('Network unavailable'); error.cause = error;
  assert.equal(h.ctx.isHlSignatureCancelled(error), false);
  assert.equal(h.ctx.isHlSignatureCancelled(null), false);
});
