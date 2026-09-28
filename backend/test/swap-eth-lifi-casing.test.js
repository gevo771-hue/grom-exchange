import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchLifiOcQuote } from '../src/liquidity/lifi-proxy.js';

const ACCT = '0x1111111111111111111111111111111111111111';
const USDC_LOWER = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const USDC_BAD_CASE = '0xA0b86991c6218b36c1D19d4a2e9EB0cE3606eB48';

const noopCache = {
  readCache: async () => null,
  writeCache: async () => {},
};

describe('Ethereum oc-quote LI.FI address casing (ETH-P1)', () => {
  it('sends lowercase USDC on chain 1 (mixed-case was rejected by LI.FI)', async () => {
    let hitUrl = '';
    const out = await fetchLifiOcQuote(
      {
        fromChainId: 1,
        fromSym: 'ETH',
        toSym: 'USDC',
        amountStr: '0.01',
        account: ACCT,
        slippage: '0.005',
      },
      {
        ...noopCache,
        httpGet: async (url) => {
          hitUrl = String(url);
          assert.match(hitUrl, new RegExp(`toToken=${USDC_LOWER}`, 'i'));
          assert.doesNotMatch(hitUrl, /toToken=0xA0b86991c6218b36c1D19d4a2e9EB0/);
          const u = new URL(url);
          assert.equal(u.searchParams.get('toToken')?.toLowerCase(), USDC_LOWER);
          assert.equal(u.searchParams.get('fromToken'), '0x0000000000000000000000000000000000000000');
          assert.equal(u.searchParams.get('fromChain'), '1');
          return {
            status: 200,
            data: {
              type: 'lifi',
              tool: 'mock',
              estimate: { toAmount: '25000000' },
              action: {
                fromChainId: 1,
                toChainId: 1,
                fromToken: { address: '0x0000000000000000000000000000000000000000' },
                toToken: { address: USDC_LOWER },
                fromAddress: ACCT,
                toAddress: ACCT,
                fromAmount: '10000000000000000',
                slippage: 0.005,
              },
              transactionRequest: {
                to: '0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae',
                data: '0xdead',
                from: ACCT,
                value: '0x2386f26fc10000',
              },
            },
          };
        },
      },
    );
    assert.equal(out.cached, false);
    assert.equal(out.context.toToken, USDC_LOWER);
    assert.equal(out.lifi.estimate.toAmount, '25000000');
  });

  it('normalizes bad mixed-case body toToken before LI.FI', async () => {
    let hitUrl = '';
    await fetchLifiOcQuote(
      {
        fromChainId: 1,
        fromSym: 'ETH',
        toSym: 'USDC',
        toToken: USDC_BAD_CASE,
        amountStr: '0.01',
        account: ACCT,
      },
      {
        ...noopCache,
        httpGet: async (url) => {
          hitUrl = String(url);
          const u = new URL(url);
          assert.equal(u.searchParams.get('toToken'), USDC_LOWER);
          return {
            status: 200,
            data: {
              estimate: { toAmount: '1' },
              action: {
                fromChainId: 1,
                toChainId: 1,
                fromToken: { address: '0x0000000000000000000000000000000000000000' },
                toToken: { address: USDC_LOWER },
                fromAddress: ACCT,
                toAddress: ACCT,
                fromAmount: '10000000000000000',
              },
            },
          };
        },
      },
    );
    assert.match(hitUrl, /toToken=0xa0b86991/);
  });

  it('preserves LI.FI token-not-found message instead of opaque no route', async () => {
    const upstreamMsg = `Could not find token '${USDC_BAD_CASE}' on chain '1' (${USDC_BAD_CASE})`;
    await assert.rejects(
      () => fetchLifiOcQuote(
        {
          fromChainId: 1,
          fromSym: 'ETH',
          toSym: 'USDC',
          amountStr: '0.01',
          account: ACCT,
        },
        {
          ...noopCache,
          httpGet: async () => ({
            status: 404,
            data: { message: upstreamMsg, code: 1003 },
          }),
        },
      ),
      (err) => {
        assert.equal(err.status, 404);
        assert.equal(err.code, 'lifi_token_not_found');
        assert.match(err.message, /Could not find token/i);
        assert.equal(err.upstream?.code, 1003);
        return true;
      },
    );
  });

  it('USDC→USDT also lowercases both tokens in query', async () => {
    let params;
    await fetchLifiOcQuote(
      {
        fromChainId: 1,
        fromSym: 'USDC',
        toSym: 'USDT',
        amountStr: '100',
        account: ACCT,
      },
      {
        ...noopCache,
        httpGet: async (url) => {
          params = new URL(url).searchParams;
          return {
            status: 200,
            data: {
              estimate: { toAmount: '99000000' },
              action: {
                fromChainId: 1,
                toChainId: 1,
                fromToken: { address: USDC_LOWER },
                toToken: { address: '0xdac17f958d2ee523a2206206994597c13d831ec7' },
                fromAddress: ACCT,
                toAddress: ACCT,
                fromAmount: '100000000',
              },
            },
          };
        },
      },
    );
    assert.equal(params.get('fromToken'), USDC_LOWER);
    assert.equal(params.get('toToken'), '0xdac17f958d2ee523a2206206994597c13d831ec7');
    assert.equal(params.get('fromAmount'), '100000000');
  });
});
