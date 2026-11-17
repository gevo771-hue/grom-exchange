import test from 'node:test';
import assert from 'node:assert/strict';
import { createTokenLogos, parseAddressList, logosFromPairs, buildCoinIndex, coinLogo } from '../src/liquidity/token-logos.js';

const BONK = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
const SUN = 'TSSMHYeV2uE9qYH95DqyoCuNCzEL1NvU3S';
const A = '0x' + 'a'.repeat(40);
const B = '0x' + 'B'.repeat(40);

test('token logos: address list is cleaned, de-duplicated and capped', () => {
  assert.deepEqual(parseAddressList(`${A},${A.toUpperCase().replace('0X', '0x')}, ${BONK},bad,<x>,0x${'0'.repeat(40)}`), [A, BONK]);
  assert.equal(parseAddressList(Array.from({ length: 50 }, (_, i) => '0x' + String(i).padStart(40, '1')).join(',')).length, 30);
});

test('token logos: only base tokens that were asked for, https images only', () => {
  const pairs = [
    { baseToken: { address: BONK }, info: { imageUrl: 'https://cdn.dexscreener.com/cms/images/bonk' } },
    { baseToken: { address: SUN }, info: { imageUrl: 'javascript:alert(1)' } },
    { baseToken: { address: 'Other1111111111111111111111111111' }, info: { imageUrl: 'https://x/y.png' } },
  ];
  assert.deepEqual(logosFromPairs(pairs, [BONK, SUN]), { [BONK]: 'https://cdn.dexscreener.com/cms/images/bonk' });
});

test('token logos: DexScreener first, GeckoTerminal for the rest, cached (miss 1 day)', async () => {
  let t = 1_800_000_000_000;
  const calls = [];
  const get = async (url) => {
    calls.push(url);
    if (url.includes('dexscreener')) return { data: [{ baseToken: { address: A }, info: { imageUrl: 'https://cdn.dexscreener.com/a.png' } }] };
    return { data: { data: [{ attributes: { address: B.toLowerCase(), image_url: 'https://assets.geckoterminal.com/b.png' } }] } };
  };
  const logos = createTokenLogos({ get, now: () => t, loadCoins: async () => buildCoinIndex({}) });
  const C = '0x' + 'c'.repeat(40);
  assert.deepEqual(await logos(999, [A, B, C]), { [A]: 'https://cdn.dexscreener.com/a.png', [B.toLowerCase()]: 'https://assets.geckoterminal.com/b.png' });
  assert.equal(calls.length, 2);
  assert.ok(calls[0].includes('/hyperevm/'));
  await logos(999, [A, B, C]);
  assert.equal(calls.length, 2); // all cached, C as a miss
  t += 86400e3 + 1;
  await logos(999, [C]);
  assert.equal(calls.length, 4); // the miss is asked again after a day
  assert.deepEqual(await logos(12345, [A]), {}); // unknown network
});

test('token logos: no answer → nothing cached', async () => {
  let n = 0;
  const logos = createTokenLogos({ get: async () => { n++; throw new Error('down'); } });
  assert.deepEqual(await logos(1, [A]), {});
  await logos(1, [A]);
  assert.equal(n, 2);
});

const OP10 = '0x4200000000000000000000000000000000000042';
const OPARB = '0xaC800FD6159c2a2CB8fC31EF74621eB430287a5A';
const LISTS = {
  10: [{ address: OP10, symbol: 'OP', coinKey: 'OP', verificationStatus: 'verified', logoURI: 'https://optimistic.etherscan.io/op.png' }],
  42161: [
    { address: OPARB, symbol: 'OP', coinKey: 'OP', verificationStatus: 'verified', logoURI: 'https://static.debank.com/op-arb.png' },
    { address: A, symbol: 'SHIB', coinKey: 'SHIB', verificationStatus: 'flagged', logoURI: '' },
    { address: B, symbol: 'PEPE', coinKey: 'PEPE', verificationStatus: 'unverified', logoURI: '' },
  ],
  1: [
    { address: '0x' + 'd'.repeat(40), symbol: 'SHIB', coinKey: 'SHIB', verificationStatus: 'verified', logoURI: 'https://x.test/shib.png' },
    { address: '0x' + 'e'.repeat(39) + 'f', symbol: 'PEPE', coinKey: 'PEPE', verificationStatus: 'verified', logoURI: 'https://x.test/pepe.png' },
  ],
};

test('token logos: a verified bridged coin takes the same coin\'s logo, look-alikes do not', () => {
  const ix = buildCoinIndex(LISTS);
  assert.equal(coinLogo(ix, 42161, OPARB.toLowerCase()), 'https://optimistic.etherscan.io/op.png'); // not its own (failed) logo
  assert.equal(coinLogo(ix, 10, OP10), 'https://static.debank.com/op-arb.png');
  assert.equal(coinLogo(ix, 42161, A), ''); // flagged by LI.FI
  assert.equal(coinLogo(ix, 42161, B.toLowerCase()), ''); // not verified on its own network
  assert.equal(coinLogo(ix, 8453, OPARB.toLowerCase()), ''); // unknown on that network
});

test('token logos: same-coin logo before GeckoTerminal; the LI.FI list is loaded once a day', async () => {
  let t = 1_800_000_000_000;
  const calls = [];
  let loads = 0;
  const get = async (url) => { calls.push(url); return { data: url.includes('dexscreener') ? [] : { data: [] } }; };
  const logos = createTokenLogos({ get, now: () => t, loadCoins: async () => { loads++; return buildCoinIndex(LISTS); } });
  assert.deepEqual(await logos(42161, [OPARB]), { [OPARB.toLowerCase()]: 'https://optimistic.etherscan.io/op.png' });
  assert.equal(calls.filter((u) => u.includes('geckoterminal')).length, 0);
  t += 3000;
  await logos(42161, [A]);
  t += 3000;
  await logos(42161, [B]);
  assert.equal(loads, 1);
  t += 86400e3 + 1;
  await logos(42161, ['0x' + '9'.repeat(40)]);
  assert.equal(loads, 2);
});

test('token logos: when a source did not answer, a miss is kept only 10 minutes', async () => {
  let t = 1_800_000_000_000;
  let ds = 0;
  const get = async (url) => { if (url.includes('dexscreener')) { ds++; return { data: [] }; } throw new Error('429'); };
  const logos = createTokenLogos({ get, now: () => t, loadCoins: async () => { throw new Error('down'); } });
  const meta = {};
  await logos(42161, [A], meta);
  assert.equal(meta.partial, true); // the page asks again in a couple of minutes
  t += 60e3;
  await logos(42161, [A]);
  assert.equal(ds, 1); // cached for now
  t += 600e3;
  await logos(42161, [A]);
  assert.equal(ds, 2); // asked again soon, not after a day
});

test('token logos: a request right behind another waits for its GeckoTerminal turn', async () => {
  let t = 1_800_000_000_000;
  const gt = [];
  const waits = [];
  const get = async (url) => {
    if (url.includes('dexscreener')) return { data: [] };
    gt.push(url);
    return { data: { data: [] } };
  };
  const logos = createTokenLogos({ get, now: () => t, sleep: async (ms) => { waits.push(ms); t += ms; }, loadCoins: async () => buildCoinIndex({}) });
  const m1 = {};
  await logos(999, [A], m1);
  t += 600; // the next 30 rows, a moment later
  const m2 = {};
  await logos(999, [B], m2);
  assert.equal(gt.length, 2);
  assert.deepEqual(waits, [1900]);
  assert.equal(m1.partial, undefined);
  assert.equal(m2.partial, undefined);
});
