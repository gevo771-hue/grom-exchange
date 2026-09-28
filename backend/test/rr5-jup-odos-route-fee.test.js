/**
 * RR6 — Real Express route tests for Jupiter / Odos fee enforcement.
 * - Jupiter: production wallet router + mocked Solana RPC + Jupiter upstream
 * - Odos: production createOdosRouter (not a copied handler)
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import axios from 'axios';

const SOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const FEE_USDC = 'GromUsdcFeeAcct111111111111111111111111111';
const FEE_SOL = 'GromWsolFeeAcct111111111111111111111111111';
const FEE_OWNER = 'GromFeeAuth111111111111111111111111111111';
const USER = 'UserPubkey111111111111111111111111111111111';
const RPC = 'http://127.0.0.1:8899-mock-solana-rpc';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

function liveQuoteFixture({ inputMint, outputMint, amount, platformFeeBps = 20 }) {
  return {
    inputMint,
    outputMint,
    inAmount: String(amount),
    outAmount: '990000',
    otherAmountThreshold: '980000',
    swapMode: 'ExactIn',
    slippageBps: 50,
    priceImpactPct: '0.01',
    routePlan: [{ swapInfo: { ammKey: 'amm1', inputMint, outputMint, inAmount: String(amount), outAmount: '990000' }, percent: 100 }],
    contextSlot: 123456,
    timeTaken: 0.012,
    platformFee: { amount: '2339', feeBps: Number(platformFeeBps) },
  };
}

function capturedUpstream(prevFetch, { feeOwner = FEE_OWNER, accountByFee = null } = {}) {
  const calls = [];
  const accounts = accountByFee || {
    [FEE_USDC]: { mint: USDC, owner: feeOwner, program: TOKEN_PROGRAM },
    [FEE_SOL]: { mint: SOL, owner: feeOwner, program: TOKEN_PROGRAM },
  };
  const fetchImpl = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('127.0.0.1') && !u.includes('8899-mock')) {
      return prevFetch(url, init);
    }
    const body = init.body ? String(init.body) : '';
    calls.push({ url: u, method: (init.method || 'GET').toUpperCase(), body });

    if (u === RPC || u.includes('8899-mock-solana-rpc')) {
      const req = JSON.parse(body || '{}');
      const acct = req?.params?.[0];
      const info = accounts[acct];
      if (!info) {
        return { ok: true, status: 200, json: async () => ({ jsonrpc: '2.0', result: { value: null } }), text: async () => '{}' };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          result: {
            value: {
              owner: info.program,
              data: { parsed: { info: { mint: info.mint, owner: info.owner } } },
            },
          },
        }),
        text: async () => '{}',
      };
    }

    if (u.includes('odos.xyz') || u.includes('/sor/quote')) {
      const parsed = JSON.parse(body || '{}');
      return {
        ok: true,
        status: 200,
        json: async () => ({ pathId: 'p1', referralCode: parsed.referralCode }),
        text: async () => JSON.stringify({ pathId: 'p1', referralCode: parsed.referralCode }),
      };
    }
    if (u.includes('jup.ag') && u.includes('/quote')) {
      const qs = new URL(u).searchParams;
      const quote = liveQuoteFixture({
        inputMint: qs.get('inputMint'),
        outputMint: qs.get('outputMint'),
        amount: qs.get('amount'),
        platformFeeBps: qs.get('platformFeeBps') || 20,
      });
      return { ok: true, status: 200, text: async () => JSON.stringify(quote), json: async () => quote };
    }
    if (u.includes('jup.ag') && u.includes('/swap')) {
      const parsed = JSON.parse(body || '{}');
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          swapTransaction: 'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAbase64tx',
          lastValidBlockHeight: 1,
          _echoFeeAccount: parsed.feeAccount || null,
          _echoHasPlatformFee: !!(parsed.quoteResponse?.platformFee),
        }),
        json: async () => ({ swapTransaction: 'base64tx' }),
      };
    }
    return { ok: false, status: 500, text: async () => 'nope', json: async () => ({ error: 'nope' }) };
  };
  return { calls, fetchImpl };
}

describe('RR6 Jupiter/Odos real route fee enforcement', () => {
  let server;
  let baseUrl;
  let prevFetch;
  let upstream;
  let prevEnv;
  let axiosPostOrig;

  before(async () => {
    prevEnv = {
      GROM_JUP_FEE_MODE: process.env.GROM_JUP_FEE_MODE,
      GROM_JUP_FEE_ACCOUNTS_JSON: process.env.GROM_JUP_FEE_ACCOUNTS_JSON,
      GROM_JUP_FEE_OWNER: process.env.GROM_JUP_FEE_OWNER,
      GROM_FEE_BPS: process.env.GROM_FEE_BPS,
      GROM_ODOS_REFERRAL_CODE: process.env.GROM_ODOS_REFERRAL_CODE,
      SOLANA_RPC_URL: process.env.SOLANA_RPC_URL,
      GROM_SOLANA_RPC: process.env.GROM_SOLANA_RPC,
    };
    process.env.GROM_JUP_FEE_MODE = 'fee';
    process.env.GROM_JUP_FEE_ACCOUNTS_JSON = JSON.stringify({ [USDC]: FEE_USDC, [SOL]: FEE_SOL });
    process.env.GROM_JUP_FEE_OWNER = FEE_OWNER;
    process.env.GROM_FEE_BPS = '20';
    process.env.GROM_ODOS_REFERRAL_CODE = '4242';
    process.env.SOLANA_RPC_URL = RPC;
    delete process.env.GROM_SOLANA_RPC;

    const { resetJupFeeCachesForTests } = await import('../src/wallet/jup-fee.js');
    resetJupFeeCachesForTests();

    const config = (await import('../src/config/index.js')).default;
    config.liquidity.jupiterFeeMode = 'fee';
    config.liquidity.jupiterFeeAccountsJson = process.env.GROM_JUP_FEE_ACCOUNTS_JSON;
    config.liquidity.jupiterFeeOwner = FEE_OWNER;
    config.liquidity.solanaRpcUrl = RPC;
    config.liquidity.feeBps = 20;
    config.liquidity.odosReferralCode = 4242;
    config.liquidity.odosUrl = 'https://api.odos.xyz';

    prevFetch = globalThis.fetch;
    upstream = capturedUpstream(prevFetch);
    globalThis.fetch = upstream.fetchImpl;

    /* Axios is used by production Odos router — stub post */
    axiosPostOrig = axios.post;
    axios.post = async (url, data, opts) => {
      const r = await upstream.fetchImpl(url, {
        method: 'POST',
        body: JSON.stringify(data || {}),
        headers: opts?.headers,
      });
      const body = await r.json();
      return { status: r.status || 200, data: body };
    };

    const { default: createWalletRouter } = await import('../src/wallet/routes.js');
    const { createOdosRouter } = await import('../src/liquidity/odos-routes.js');
    const app = express();
    app.use(express.json());
    const requireAuth = (_req, res) => res.status(401).json({ error: 'auth_required' });
    app.use('/api', createWalletRouter({ requireAuth }));
    app.use('/api/swap', createOdosRouter({ config }));

    server = createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    globalThis.fetch = prevFetch;
    axios.post = axiosPostOrig;
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    if (server) {
      await new Promise((r) => server.close(r));
      server.closeAllConnections?.();
    }
    try {
      const { pool } = await import('../src/db/pool.js');
      await pool.end().catch(() => {});
    } catch (_) {}
  });

  it('Jupiter quote preserves platformFee and platformFeeBps=20 upstream', async () => {
    upstream.calls.length = 0;
    const res = await fetch(
      `${baseUrl}/api/wallet/jup-quote?inputMint=${SOL}&outputMint=${USDC}&amount=1000000&slippageBps=50`
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.platformFee?.feeBps, 20);
    assert.equal(body.platformFee?.amount, '2339');
    assert.ok(body.contextSlot, 'must preserve contextSlot');
    assert.ok(Array.isArray(body.routePlan));
    assert.equal(body._gromFeeAccount, FEE_USDC);
    assert.equal(body._gromFeeBps, 20);
    assert.equal(body._gromFeeMode, 'fee');
    /* platformFee is the fee proof; _gromFeeBps is UI metadata only */
    const quoteCall = upstream.calls.find((c) => c.url.includes('jup.ag') && c.url.includes('/quote'));
    assert.ok(quoteCall);
    assert.equal(new URL(quoteCall.url).searchParams.get('platformFeeBps'), '20');
  });

  it('attachJupQuoteMeta must not drop platformFee (normalizer contract)', async () => {
    const { attachJupQuoteMeta, assertJupPlatformFee } = await import('../src/wallet/jup-fee.js');
    const upstreamQ = liveQuoteFixture({ inputMint: SOL, outputMint: USDC, amount: '1000000' });
    const out = attachJupQuoteMeta(upstreamQ, { _gromFeeAccount: FEE_USDC });
    assert.deepEqual(out.platformFee, upstreamQ.platformFee);
    assert.equal(assertJupPlatformFee(out, 20).ok, true);
    /* Simulate legacy stripper — must fail assert */
    const stripped = {
      inputMint: upstreamQ.inputMint,
      outputMint: upstreamQ.outputMint,
      inAmount: upstreamQ.inAmount,
      outAmount: upstreamQ.outAmount,
      routePlan: upstreamQ.routePlan,
      _gromFeeBps: 20,
    };
    assert.equal(assertJupPlatformFee(stripped, 20).ok, false);
  });

  it('Jupiter swap forwards full quote platformFee + per-mint feeAccount', async () => {
    upstream.calls.length = 0;
    const quote = liveQuoteFixture({ inputMint: SOL, outputMint: USDC, amount: '1000000' });
    quote._gromFeeAccount = 'should-be-stripped';
    const res = await fetch(`${baseUrl}/api/wallet/jup-swap`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        userPublicKey: USER,
        quoteResponse: quote,
        feeAccount: 'EvilClientFeeAccount111111111111111111111',
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.swapTransaction);
    assert.equal(body._gromFeeAccount, FEE_USDC);
    const swapCall = upstream.calls.find((c) => c.url.includes('/swap') && c.method === 'POST' && c.url.includes('jup.ag'));
    assert.ok(swapCall);
    const sent = JSON.parse(swapCall.body);
    assert.equal(sent.feeAccount, FEE_USDC);
    assert.equal(sent.quoteResponse.platformFee.feeBps, 20);
    assert.equal(sent.quoteResponse._gromFeeAccount, undefined);
  });

  it('unsuitable mint pair → 503 fee_config_unavailable (no executable tx)', async () => {
    const UNKNOWN = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
    const OTHER = 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3';
    upstream.calls.length = 0;
    const res = await fetch(
      `${baseUrl}/api/wallet/jup-quote?inputMint=${UNKNOWN}&outputMint=${OTHER}&amount=1000000&slippageBps=50`
    );
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.error, 'fee_config_unavailable');
    assert.equal(
      upstream.calls.filter((c) => c.url.includes('jup.ag')).length,
      0,
      'must not call Jupiter when fee unavailable',
    );
  });

  it('swap without platformFee → 409/502, never returns swapTransaction', async () => {
    const bad = liveQuoteFixture({ inputMint: SOL, outputMint: USDC, amount: '1' });
    delete bad.platformFee;
    const res = await fetch(`${baseUrl}/api/wallet/jup-swap`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userPublicKey: USER, quoteResponse: bad }),
    });
    assert.ok(res.status === 409 || res.status === 502);
    const body = await res.json();
    assert.equal(body.swapTransaction, undefined);
  });

  it('Odos production router overwrites client referralCode', async () => {
    upstream.calls.length = 0;
    const res = await fetch(`${baseUrl}/api/swap/odos/quote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chainId: 1, referralCode: 0, inputTokens: [] }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.referralCode, 4242);
    const odosCall = upstream.calls.find((c) => c.url.includes('odos'));
    assert.ok(odosCall);
    assert.equal(JSON.parse(odosCall.body).referralCode, 4242);
  });

  it('Odos missing server config → 503 (production handler)', async () => {
    const config = (await import('../src/config/index.js')).default;
    const prev = config.liquidity.odosReferralCode;
    config.liquidity.odosReferralCode = 0;
    const res = await fetch(`${baseUrl}/api/swap/odos/quote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chainId: 1, referralCode: 99 }),
    });
    config.liquidity.odosReferralCode = prev;
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.error, 'odos_fee_unconfigured');
    assert.equal(body.transaction, undefined);
    assert.equal(body.swapTransaction, undefined);
  });
});
