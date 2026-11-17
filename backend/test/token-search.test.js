import test from 'node:test';
import assert from 'node:assert/strict';
import { pickSearchTokens, createTokenSearch } from '../src/liquidity/token-search.js';

const ROCCO = '0xFeeD37054d2812f9A4bF5ac2D5E1b5D5DE13F0A1';
const pair = (chainId, base, quote, { liq = 250_000, vol = 3_000_000, img = 'https://cdn.dexscreener.com/x.png', px = '0.0079' } = {}) => ({
  chainId, baseToken: base, quoteToken: quote, liquidity: { usd: liq }, volume: { h24: vol }, info: { imageUrl: img }, priceUsd: px,
});
const WETH = { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', name: 'Wrapped Ether' };

test('token search: matching side, real liquidity, swap networks, busiest pool per token', () => {
  const rows = pickSearchTokens([
    pair('ethereum', { address: ROCCO, symbol: 'Rocco', name: 'Rocco' }, WETH),
    pair('ethereum', { address: ROCCO, symbol: 'Rocco', name: 'Rocco' }, WETH, { liq: 20_000, vol: 10 }),
    pair('robinhood', { address: '0x79b81678faea00000000000000000000000000aa', symbol: 'ROCCO', name: 'Rocco' }, WETH, { liq: 21_000, vol: 1 }),
    pair('solana', { address: 'HZbiEpF2oM658E1111111111111111111111111111', symbol: 'Rocco', name: 'Rocco' }, { address: 'So11111111111111111111111111111111111111112', symbol: 'SOL', name: 'Wrapped SOL' }, { liq: 93_000, vol: 300_000 }),
    pair('solana', { address: 'FJbyUWahiRMtLn1111111111111111111111111111', symbol: 'ROCCO', name: 'GTA VI DOG' }, WETH, { liq: 86 }), // dust
    pair('ton', { address: 'EQabc', symbol: 'ROCCO', name: 'Rocco' }, WETH), // not a swap network
    pair('ethereum', { address: '0x' + '1'.repeat(40), symbol: 'BROCCOLI', name: 'Broccoli' }, WETH, { liq: 50_000, vol: 5_000 }),
  ], 'rocco');
  assert.deepEqual(rows.map((r) => [r.chainId, r.sym]), [[1, 'ROCCO'], [1151111081099710, 'ROCCO'], [4663, 'ROCCO'], [1, 'BROCCOLI']]);
  assert.equal(rows[0].address, ROCCO.toLowerCase());
  assert.equal(rows[0].liq, 250_000);
  assert.equal(rows[0].logo, 'https://cdn.dexscreener.com/x.png');
});

test('token search: only tokens LI.FI knows, decimals from LI.FI, answers cached', async () => {
  let ds = 0;
  let lifi = 0;
  const get = async (url, opts) => {
    if (url.includes('dexscreener')) {
      ds++;
      return { data: { pairs: [
        pair('ethereum', { address: ROCCO, symbol: 'Rocco', name: 'Rocco' }, WETH),
        pair('base', { address: '0x' + '2'.repeat(40), symbol: 'ROCCOX', name: 'Rocco X' }, WETH),
      ] } };
    }
    lifi++;
    if (opts.params.token === ROCCO.toLowerCase()) return { data: { decimals: 9, name: 'Rocco', logoURI: 'https://l/r.png' } };
    const e = new Error('nf'); e.response = { status: 404 }; throw e;
  };
  const search = createTokenSearch({ get });
  const rows = await search('Rocco');
  assert.deepEqual(rows.map((r) => [r.chainId, r.sym, r.decimals]), [[1, 'ROCCO', 9]]);
  await search('rocco ');
  assert.equal(ds, 1);
  assert.equal(lifi, 2);
  assert.deepEqual(await search('r'), []);
});
