import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {
  buildStocksUniverse, classifyLifiStockToken, compactStockRow, detailStockPayload,
  sumTokenLiquidity, createStockLiquidity, createStocksUniverse, registerStocksRoutes, namesAgree,
} from '../src/market/stocks-universe.js';

const A = (n) => '0x' + String(n).padStart(40, '0');
const MINT = 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB';
const catalog = [
  { sym: 'TSLA', yahooSym: 'TSLA', tokenSym: 'TSLAx', name: 'Tesla xStock', addrs: { 1: A(1), 56: A(1), 5000: A(1) }, chains: [1, 56, 5000], solMint: MINT, solDecimals: 8, decimals: 18, price: 358, fairPrice: 358.2, mc: '$1.42T', vol24: '$179.6K', chg: 4.2 },
  { sym: 'P', yahooSym: 'P', tokenSym: 'Px', name: 'Pandora xStock', addrs: { 1: A(9) }, chains: [1], solMint: '', decimals: 18, price: 9, fairPrice: 9.1, mc: '—', vol24: '—' },
];
const lifi = {
  1: [
    { symbol: 'TSLAon', name: 'Tesla (Ondo Tokenized)', address: A(2), decimals: 18, priceUSD: '359', verificationStatus: 'verified' },
    { symbol: 'IVVon', name: 'iShares Core S&P 500 ETF (Ondo Tokenized)', address: A(3), decimals: 18, priceUSD: '690' },
    { symbol: 'USDC', name: 'USD Coin', address: A(4), decimals: 6, priceUSD: '1' },
  ],
  999: [{ symbol: 'TSLAx', name: 'Tesla xStock', address: A(1), decimals: 18, priceUSD: '358' }],
  4663: [
    { symbol: 'TSLA', name: 'Tesla', address: A(5), decimals: 18, priceUSD: '359.3', logoURI: 'https://cdn.robinhood.com/ncw_assets/logos/x.png', verificationStatus: 'verified' },
    { symbol: 'P', name: 'Everpure', address: A(6), decimals: 18, priceUSD: '95', logoURI: 'https://cdn.robinhood.com/ncw_assets/logos/p.png' },
    { symbol: 'PENGU', name: 'Pudgy Penguins', address: A(7), decimals: 18, priceUSD: '0.006', verificationStatus: 'flagged', logoURI: 'https://cdn.robinhood.com/ncw_assets/logos/pengu.png' },
    { symbol: 'HOODRAT', name: 'Hoodrat', address: A(8), decimals: 18, priceUSD: '0.0007' },
  ],
  5000: [{ symbol: 'TSLAx', name: 'Tesla xStock', address: A(1), decimals: 18 }],
};

test('only clearly tokenized shares are classified', () => {
  assert.equal(classifyLifiStockToken(lifi[1][2], 1), null, 'stablecoin');
  assert.equal(classifyLifiStockToken(lifi[4663][2], 4663), null, 'flagged meme with a borrowed logo');
  assert.equal(classifyLifiStockToken(lifi[4663][3], 4663), null, 'meme without issuer logo');
  assert.equal(classifyLifiStockToken(lifi[1][0], 1).ticker, 'TSLA');
  assert.equal(classifyLifiStockToken(lifi[4663][0], 4663).kind, 'rh');
  assert.equal(classifyLifiStockToken({ symbol: 'TSLA', name: 'Tesla', address: A(5), decimals: 18, logoURI: 'https://cdn.robinhood.com/ncw_assets/x.png' }, 1), null, 'issuer logo outside Robinhood Chain');
  assert.equal(classifyLifiStockToken({ ...lifi[1][0], address: '0x0000000000000000000000000000000000000000' }, 1), null);
});

test('universe groups every network under one ticker and keeps unsupported chains out', () => {
  const items = buildStocksUniverse({ catalog, lifiTokens: lifi });
  const tsla = items.find((i) => i.sym === 'TSLA');
  const kinds = tsla.variants.map((v) => `${v.k}@${v.c}`).sort();
  assert.deepEqual(kinds, ['on@1', 'rh@4663', 'x@1', 'x@56', 'x@999', 'x@solana'].sort());
  assert.equal(tsla.name, 'Tesla');
  const ivv = items.find((i) => i.sym === 'IVV');
  assert.equal(ivv.src, 'lifi');
  assert.equal(ivv.k, 'etf');
  // Same ticker, different company and price → not merged into the catalog item.
  const p = items.find((i) => i.sym === 'P');
  assert.equal(p.variants.some((v) => v.k === 'rh'), false);
  assert.equal(namesAgree('Cerebras Systems', 'Cerebras Systems Inc.'), true);
  assert.equal(namesAgree('Pandora', 'Everpure'), false);
});

test('list rows carry no contract addresses; detail rows do', () => {
  const items = buildStocksUniverse({ catalog, lifiTokens: lifi });
  const tsla = items.find((i) => i.sym === 'TSLA');
  const row = compactStockRow(tsla);
  assert.equal(JSON.stringify(row).includes(A(1)), false);
  assert.equal(row.mc, 1.42e12);
  assert.ok(row.nets.includes('robinhood') && row.nets.includes('solana'));
  const detail = detailStockPayload(tsla);
  assert.ok(detail.variants.every((v) => v.a && v.net));
});

test('liquidity counts only pools against stables, natives or other stocks', () => {
  const me = A(5);
  const pairs = [
    { baseToken: { address: me, symbol: 'TSLA' }, quoteToken: { address: A(11), symbol: 'USDG' }, liquidity: { usd: 1000 }, volume: { h24: 50 } },
    { baseToken: { address: me, symbol: 'TSLA' }, quoteToken: { address: A(12), symbol: 'SPY' }, liquidity: { usd: 500 }, volume: { h24: 5 } },
    { baseToken: { address: A(13), symbol: 'MEME' }, quoteToken: { address: me, symbol: 'TSLA' }, liquidity: { usd: 99999 }, volume: { h24: 9 } },
    { baseToken: { address: A(14), symbol: 'X' }, quoteToken: { address: A(15), symbol: 'Y' }, liquidity: { usd: 7 } },
  ];
  assert.deepEqual(sumTokenLiquidity(pairs, me, new Set([A(12)])), { liq: 1500, vol: 55, pools: 2 });
});

test('liquidity loader caches per ticker and respects its request budget', async () => {
  let calls = 0;
  let now = 0;
  const liq = createStockLiquidity({ fetchPairs: async () => { calls++; return []; }, now: () => now, maxPerMinute: 3 });
  const item = { sym: 'TSLA', variants: [{ c: 1, a: A(1) }, { c: 'solana', a: MINT }] };
  await liq.forItem(item);
  await liq.forItem(item);
  assert.equal(calls, 2);
  const other = { sym: 'AAPL', variants: [{ c: 1, a: A(2) }, { c: 56, a: A(2) }] };
  assert.equal(await liq.forItem(other), null, 'over budget → unknown, not zero');
  now = 61_000;
  assert.ok(await liq.forItem(other));
});

test('routes: list, detail with liquidity and reference, unknown ticker', async () => {
  const universe = createStocksUniverse({ getCatalog: async () => catalog, fetchLifiTokens: async () => lifi, coldLifiWaitMs: 50 });
  const liquidity = createStockLiquidity({ fetchPairs: async (_slug, address) => [{ baseToken: { address, symbol: 'T' }, quoteToken: { address: A(20), symbol: 'USDC' }, liquidity: { usd: 2000 }, volume: { h24: 10 } }] });
  const app = express();
  const r = express.Router();
  registerStocksRoutes(r, { universe, liquidity, fetchReference: async () => ({ price: 358.2, solMultiplier: 1 }) });
  app.use('/api/market', r);
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/market`;
    const list = await (await fetch(`${base}/stocks`)).json();
    assert.ok(list.items.find((x) => x.s === 'IVV'));
    const det = await (await fetch(`${base}/stocks/detail?sym=tsla`)).json();
    assert.equal(det.s, 'TSLA');
    assert.equal(det.ref.price, 358.2);
    assert.ok(det.variants.every((v) => v.liq === 2000));
    const miss = await fetch(`${base}/stocks/detail?sym=NOPE`);
    assert.equal(miss.status, 404);
  } finally {
    server.close();
  }
});

test('universe picks up refreshed catalog prices (new catalog array)', async () => {
  let cat = catalog.map((c) => ({ ...c, price: 0, fairPrice: 0 }));
  const universe = createStocksUniverse({ getCatalog: async () => cat, fetchLifiTokens: async () => ({}), coldLifiWaitMs: 10 });
  assert.equal((await universe.find('TSLA')).fairPrice, 0);
  cat = catalog.map((c) => ({ ...c }));
  assert.equal((await universe.find('TSLA')).fairPrice, 358.2);
});

test('background pre-warming never takes the visitors\' half of the budget', async () => {
  const liq = createStockLiquidity({ fetchPairs: async () => [], now: () => 0, maxPerMinute: 4 });
  const mk = (s) => ({ sym: s, variants: [{ c: 1, a: A(1) }, { c: 56, a: A(2) }] });
  assert.ok(await liq.forItem(mk('A'), new Set(), { background: true }));
  assert.equal(await liq.forItem(mk('B'), new Set(), { background: true }), null);
  assert.ok(await liq.forItem(mk('C'), new Set()));
});

test('market cap and turnover of non-US listings are not shown as USD', () => {
  const items = buildStocksUniverse({ catalog: [{ sym: 'TCENT', yahooSym: '0700.HK', tokenSym: 'TCENTx', name: 'Tencent xStock', addrs: { 1: A(30) }, solMint: '', mc: '$3.83T', vol24: '$551.1M', mcNum: 3.83e12 }], lifiTokens: {} });
  const row = compactStockRow(items[0]);
  assert.equal(row.mc, null);
  assert.equal(row.v, null);
});
