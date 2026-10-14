import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { tradeFacts, decimalAmount, enrichTradeFacts, addActivitySearch } from '../src/activity/trade-facts.js';
const hash = '0x' + 'ab'.repeat(32), wallet = '0x' + 'cd'.repeat(20);
const row = (detail = {}, extra = {}) => ({ product: 'swap', action: 'swap_failed', wallet_address: wallet, tx_hash: hash,
  detail: { from: 'ETH', to: 'USDC', amt: '0.000516440000000001', fromChainId: 8453, ...detail }, ...extra });
const fill = (extra = {}) => ({ product: 'swap', status: 'confirmed', chain_id: 8453, tx_hash: hash, wallet_address: wallet,
  attribution: 'lifi:grom-exchange', fee_usd: '0.02', evidence: { source: 'lifi_analytics', integrator: 'grom-exchange',
    feeCosts: [{ amount: '10000', amountUSD: '0.10', feeSplit: { integratorFee: '2000' } }] }, ...extra });
test('swap precision and cross-chain route are shown without implying execution', () => {
  const t = tradeFacts(row({ toChainId: 42161 }));
  assert.equal(t.pair, 'ETH → USDC'); assert.equal(t.amount.value, '0.000516440000000001');
  assert.equal(t.amount.asset, 'ETH'); assert.equal(t.network, 'Base → Arbitrum');
  assert.match(t.tx.url, /^https:\/\/basescan.org\/tx\//); assert.match(t.execution_label, /не проверено/);
  assert.equal(t.commission.amount_usd, null);
});
test('missing, invalid and zero amounts remain distinct; arbitrary objects are not rendered', () => {
  for (const value of [null, undefined, '', true, {}, 'Infinity', '-1', 'NaN', '1e500']) assert.equal(decimalAmount(value), null);
  assert.equal(decimalAmount('0'), '0');
  const t = tradeFacts({ product: 'predict', detail: { amount: '2', outcome: 'Yes' } });
  assert.equal(t.amount.asset, null); assert.equal(t.amount.value, '2');
  assert.equal(tradeFacts({ product: 'swap', detail: {} }).amount, null);
  assert.equal(tradeFacts({ product: 'system', detail: {} }), null);
});
test('HL dollar notional is never labelled as BTC quantity; size and price use their own fields', () => {
  const old = tradeFacts({ product: 'futures', amount: '125', asset: 'BTC', detail: { from: 'BTC', to: 'USDC', fee: '1.2' } });
  assert.equal(old.amount.asset, 'USD'); assert.equal(old.amount.value, '125'); assert.equal(old.commission.amount_usd, null);
  const t = tradeFacts({ product: 'spot', amount: '125', asset: 'BTC', detail: { size: '0.002', sizeAsset: 'BTC', side: 'buy', price: '62500' } });
  assert.equal(t.amount.asset, 'BTC'); assert.equal(t.amount.value, '0.002'); assert.equal(t.network, 'Hyperliquid');
  assert.equal(t.fields.find(f => f.label === 'Направление').value, 'Покупка');
});
test('predict and xStocks preserve product-specific intent', () => {
  const p = tradeFacts({ product: 'predict', detail: { market: 'Market?', outcome: 'Yes', amount: '2', amountAsset: 'pUSD', chainId: 137 } });
  assert.equal(p.amount.asset, 'pUSD'); assert.equal(p.network, 'Polygon'); assert.equal(p.fields[0].value, 'Market?');
  const x = tradeFacts({ product: 'xstocks', detail: { from: 'USDC', to: 'AAPLx', amount: 2, fromChainId: 42161, toChainId: 1151111081099710 } });
  assert.equal(x.network, 'Arbitrum → Solana'); assert.equal(x.pair, 'USDC → AAPLx');
});
test('only matching confirmed ledger evidence can establish GROM revenue', () => {
  assert.equal(tradeFacts(row(), [fill()]).commission.amount_usd, '0.02');
  for (const f of [fill({ status: 'reported' }), fill({ chain_id: 1 }), fill({ tx_hash: '0x' + 'ef'.repeat(32) }),
    fill({ wallet_address: '0x' + 'ef'.repeat(20) }), fill({ attribution: 'lifi:other' }), fill({ evidence: {} }), fill({ fee_usd: '500' })]) {
    assert.equal(tradeFacts(row(), [f]).commission.status, 'unavailable');
  }
  const spoof = tradeFacts(row({ feeUsd: 500, fee: 500, commission: { status: 'confirmed' }, source: 'lifi_analytics' }));
  assert.equal(spoof.commission.amount_usd, null);
  assert.equal(tradeFacts(row(), [fill(), fill()]).commission.amount_usd, null);
});
test('missing fee metadata is unknown, explicit zero share can establish zero', () => {
  const f = fill(); f.evidence.feeCosts = []; f.fee_usd = '0';
  assert.equal(tradeFacts(row(), [f]).commission.amount_usd, null);
  f.evidence.feeCosts = [{ amount: '100', amountUSD: '1', feeSplit: { integratorFee: '0' } }];
  assert.equal(tradeFacts(row(), [f]).commission.amount_usd, '0');
  f.evidence.feeCosts[0].amountUSD = null;
  assert.equal(tradeFacts(row(), [f]).commission.amount_usd, null);
});
test('diagnostic canary and unknown products never become revenue', () => {
  const t = tradeFacts(row({}, { action: 'probe-canary' }), [fill()]);
  assert.equal(t.commission.amount_usd, null); assert.match(t.execution_label, /Диагностическая/);
  assert.equal(tradeFacts({ product: 'wallet', amount: 5 }), null);
});
test('transaction links are allowlisted by network and hash, never parsed from notes', () => {
  assert.equal(tradeFacts(row({ note: hash }, { tx_hash: null })).tx, null);
  assert.equal(tradeFacts(row({ txHash: 'javascript:alert(1)' }, { tx_hash: null })).tx, null);
  assert.equal(tradeFacts(row({ fromChainId: 999 })).tx.url, null);
  assert.equal(tradeFacts(row({ fromChainId: 1 }, { tx_hash: 'hl:123' })).tx.url, null);
  const t = tradeFacts(row({ fromChainId: 1151111081099710 }, { tx_hash: '2'.repeat(88) }));
  assert.match(t.tx.url, /^https:\/\/solscan.io\/tx\//);
});
test('enrichment batches and deduplicates reads, with unavailable fallback on DB error', async () => {
  let calls = 0;
  const rows = [row(), row({}), { product: 'system' }];
  const enriched = await enrichTradeFacts(rows, async (sql, params) => { calls++; assert.match(sql, /status='confirmed'/); assert.deepEqual(params, [[hash]]); return { rows: [fill()] }; });
  assert.equal(calls, 1); assert.equal(enriched[0].trade.commission.amount_usd, '0.02'); assert.equal(enriched[2].trade, null);
  const failed = await enrichTradeFacts([row()], async () => { throw new Error('offline'); });
  assert.equal(failed[0].trade.commission.amount_usd, null); assert.match(failed[0].trade.commission.label, /временно/);
  await enrichTradeFacts([{ product: 'system' }], async () => { assert.fail('no DB read required'); });
});
test('search is parameterized and treats SQL payloads and wildcard symbols as literal text', () => {
  const filters = [], params = ['swap']; const q = "x%' OR 1=1 --";
  addActivitySearch(filters, params, q);
  assert.equal(params[1], q); assert.doesNotMatch(filters[0], /OR 1=1/); assert.match(filters[0], /lower\(\$2\)/);
});
const html = readFileSync(new URL('../../frontend/public/index.html', import.meta.url), 'utf8');
const fn = (src, name) => { const a = src.indexOf('function ' + name + '('); assert.ok(a >= 0); return src.slice(a, src.indexOf('\n}', a) + 2); };
const ctx = vm.createContext({ boffFmtTime: x => x, boffShortAddr: x => x });
vm.runInContext(['boffMonitorEsc', 'boffTradeHtml', 'boffEventDetailsHtml', 'boffIssueRowHtml'].map(n => fn(html, n)).join('\n'), ctx);
test('operation cards escape all supplied fields, expose missing data, and reject arbitrary links', () => {
  const bad = '<img src=x onerror=alert(1)>';
  const t = tradeFacts(row({ from: bad, amount: 2, market: bad }));
  t.tx.url = 'javascript:alert(1)'; t.fields.push({ label: bad, value: bad });
  const result = ctx.boffIssueRowHtml({ trade: t, wallet: bad, detail: { message: bad }, at: 'today' });
  assert.doesNotMatch(result, /<img|href="javascript/); assert.match(result, /&lt;img/);
  assert.match(result, /Комиссия GROM/); assert.match(result, /Детали операции/);
  assert.match(ctx.boffTradeHtml(tradeFacts({ product: 'swap' })), /Не записана/);
});
test('HL telemetry distinguishes a resting order from a fill', () => {
  const src = readFileSync(new URL('../../frontend/public/grom-hyperliquid.js', import.meta.url), 'utf8');
  const a = src.indexOf('  function logHlFill('), b = src.indexOf('\n  async function getExchangeClient', a);
  const logged = []; const context = vm.createContext({ window: { gwTxLogPush: e => logged.push(e) } });
  vm.runInContext(src.slice(a, b), context);
  for (const st of [{ resting: { oid: 1 } }, { filled: { oid: 2, totalSz: '0.1', avgPx: '2000' } }]) context.logHlFill({ spot: true, side: 'buy', coin: 'ETH', size: '1', mid: 2000, resp: { response: { data: { statuses: [st] } } } });
  assert.equal(logged[0].status, 'open'); assert.equal(logged[0].size, '1');
  assert.equal(logged[1].status, 'filled'); assert.equal(logged[1].size, '0.1'); assert.equal(logged[1].amt, 200);
});
