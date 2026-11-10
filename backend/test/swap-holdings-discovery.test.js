import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHoldingsPayload,
  getHoldingsTokens,
  holdingsTokenLogo,
  pickHoldingsTokens,
  resetHoldingsTokensCache,
} from '../src/liquidity/holdings-tokens.js';
import { pickFasterRoute, quoteDurationSec } from '../src/liquidity/lifi-proxy.js';

const ARB = '0x912CE59144191C1204E64559FE8253a0e49E6548';
const tok = (over) => ({
  address: ARB, symbol: 'ARB', decimals: 18, priceUSD: '0.31',
  volumeUSD24H: 11_000_000, marketCapUSD: 1_100_000_000, verificationStatus: 'verified',
  logoURI: 'https://example.com/arb.png', ...over,
});

test('discovery list keeps liquid tokens and drops junk', () => {
  const big = Array.from({ length: 500 }, (_, i) => tok({
    address: '0x' + (i + 1).toString(16).padStart(40, '0'), symbol: 'T' + i, volumeUSD24H: 1000 + i, marketCapUSD: 0,
  }));
  const raw = [
    tok(),
    tok({ address: '0x0000000000000000000000000000000000000000', symbol: 'ETH' }),
    tok({ address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', symbol: 'ETH' }),
    tok({ address: '0x1111111111111111111111111111111111111111', symbol: 'bad sym!' }),
    tok({ address: '0x2222222222222222222222222222222222222222', symbol: 'NOPRICE', priceUSD: '0' }),
    tok({ address: '0x3333333333333333333333333333333333333333', symbol: 'DEC', decimals: 99 }),
    ...big,
  ];
  const { tokens, logos } = pickHoldingsTokens(raw);
  assert.equal(tokens[0][0], ARB);
  assert.deepEqual(tokens[0].slice(1), [18, 'ARB', 0.31, 1]);
  assert.ok(!tokens.some(t => /^0x0{40}$/i.test(t[0]) || /^0xe{40}$/i.test(t[0])));
  assert.ok(!tokens.some(t => ['bad sym!', 'NOPRICE', 'DEC'].includes(t[2])));
  // Big chain: low-volume tokens below the bar are left out.
  assert.equal(tokens.length, 1);
  assert.equal(logos.get(ARB.toLowerCase()), 'https://example.com/arb.png');
});

test('small chains keep every verified priced token (tokenized stocks)', () => {
  const raw = Array.from({ length: 30 }, (_, i) => tok({
    address: '0x' + (i + 10).toString(16).padStart(40, 'a'), symbol: 'STK' + i, volumeUSD24H: 0, marketCapUSD: 0,
  }));
  const { tokens } = pickHoldingsTokens(raw);
  assert.equal(tokens.length, 30);
});

test('cached payload, logo lookup and failure handling', async () => {
  resetHoldingsTokensCache();
  let calls = 0;
  const fetcher = async () => { calls++; return { tokens: { 42161: [tok()] } }; };
  const a = await getHoldingsTokens({ fetcher });
  const b = await getHoldingsTokens({ fetcher });
  assert.equal(calls, 1);
  assert.equal(a, b);
  assert.deepEqual(Object.keys(a.chains), ['42161']);
  assert.equal(holdingsTokenLogo(42161, ARB), 'https://example.com/arb.png');
  assert.equal(holdingsTokenLogo(1, ARB), null);

  resetHoldingsTokensCache();
  await assert.rejects(getHoldingsTokens({ fetcher: async () => { throw new Error('down'); } }), { status: 503 });
  assert.throws(() => buildHoldingsPayload({ tokens: {} }), /empty/);
  resetHoldingsTokensCache();
});

const q = (toAmount, dur, over = {}) => ({
  action: { fromToken: { address: '0xa' }, toToken: { address: '0xb' }, fromAmount: '100' },
  estimate: { toAmount: String(toAmount), executionDuration: dur },
  transactionRequest: { to: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE' },
  ...over,
});

test('fast route wins when output is within 0.5%', () => {
  const rec = q(1_000_000, 1080);
  const fast = q(998_000, 20);
  assert.equal(pickFasterRoute(rec, fast), fast);
  assert.equal(quoteDurationSec(fast), 20);
});

test('fast route loses when it pays noticeably less or differs', () => {
  const rec = q(1_000_000, 1080);
  assert.equal(pickFasterRoute(rec, q(990_000, 20)), rec);
  assert.equal(pickFasterRoute(rec, q(999_000, 2000)), rec);
  assert.equal(pickFasterRoute(rec, q(999_000, 20, { transactionRequest: undefined })), rec);
  assert.equal(pickFasterRoute(rec, q(999_000, 20, {
    action: { fromToken: { address: '0xa' }, toToken: { address: '0xc' }, fromAmount: '100' },
  })), rec);
  assert.equal(pickFasterRoute(rec, null), rec);
});
