/**
 * GROM_JUP_FEE_MODE=free|fee — explicit mode, never inferred from missing env.
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import {
  resetJupFeeCachesForTests,
  jupFeeModeFromConfig,
  jupiterEnabled,
  jupiterFeeEnabled,
  jupFeeBpsFromConfig,
  jupiterFeeReady,
} from '../src/wallet/jup-fee.js';

const SOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const FEE_USDC = 'GromUsdcFeeAcct111111111111111111111111111';
const FEE_SOL = 'GromWsolFeeAcct111111111111111111111111111';
const FEE_OWNER = 'GromFeeAuth111111111111111111111111111111';
const USER = 'UserPubkey111111111111111111111111111111111';
const RPC = 'http://127.0.0.1:8899-mock-solana-rpc';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

function liveQuoteFixture({ inputMint, outputMint, amount, platformFeeBps = null }) {
  const q = {
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
  };
  if (platformFeeBps != null) {
    q.platformFee = { amount: '2339', feeBps: Number(platformFeeBps) };
  }
  return q;
}

describe('GROM_JUP_FEE_MODE unit', () => {
  beforeEach(() => resetJupFeeCachesForTests());

  it('unset / invalid mode → Jupiter disabled (never auto free)', () => {
    assert.equal(jupFeeModeFromConfig({ liquidity: {} }), null);
    assert.equal(jupiterEnabled({ liquidity: {} }), false);
    assert.equal(jupFeeModeFromConfig({ liquidity: { jupiterFeeMode: 'auto' } }), null);
    assert.equal(jupiterEnabled({ liquidity: { jupiterFeeMode: '' } }), false);
  });

  it('free: enabled without map/owner/RPC; feeEnabled false; bps 0', () => {
    const cfg = { liquidity: { jupiterFeeMode: 'free' } };
    assert.equal(jupFeeModeFromConfig(cfg), 'free');
    assert.equal(jupiterEnabled(cfg), true);
    assert.equal(jupiterFeeEnabled(cfg), false);
    assert.equal(jupFeeBpsFromConfig(cfg), 0);
    assert.equal(jupiterFeeReady(cfg), false);
  });

  it('fee: partial config → not enabled', () => {
    assert.equal(jupiterEnabled({
      liquidity: {
        jupiterFeeMode: 'fee',
        jupiterFeeAccountsJson: JSON.stringify({ [USDC]: FEE_USDC }),
        jupiterFeeOwner: FEE_OWNER,
        /* no rpc */
      },
    }), false);
    assert.equal(jupiterEnabled({
      liquidity: {
        jupiterFeeMode: 'fee',
        jupiterFeeOwner: FEE_OWNER,
        solanaRpcUrl: RPC,
        /* no map */
      },
    }), false);
    assert.equal(jupiterEnabled({
      liquidity: {
        jupiterFeeMode: 'fee',
        jupiterFeeAccountsJson: JSON.stringify({ [USDC]: FEE_USDC }),
        solanaRpcUrl: RPC,
        /* no owner */
      },
    }), false);
  });

  it('fee: full config → enabled + feeEnabled + 20 bps', () => {
    const cfg = {
      liquidity: {
        jupiterFeeMode: 'fee',
        jupiterFeeAccountsJson: JSON.stringify({ [USDC]: FEE_USDC }),
        jupiterFeeOwner: FEE_OWNER,
        solanaRpcUrl: RPC,
        feeBps: 20,
      },
    };
    assert.equal(jupiterEnabled(cfg), true);
    assert.equal(jupiterFeeEnabled(cfg), true);
    assert.equal(jupFeeBpsFromConfig(cfg), 20);
  });
});

describe('GROM_JUP_FEE_MODE route free', () => {
  let server;
  let baseUrl;
  let prevFetch;
  let calls;
  let prevEnv;
  let config;

  before(async () => {
    prevEnv = {
      GROM_JUP_FEE_MODE: process.env.GROM_JUP_FEE_MODE,
      GROM_JUP_FEE_ACCOUNTS_JSON: process.env.GROM_JUP_FEE_ACCOUNTS_JSON,
      GROM_JUP_FEE_OWNER: process.env.GROM_JUP_FEE_OWNER,
      SOLANA_RPC_URL: process.env.SOLANA_RPC_URL,
    };
    process.env.GROM_JUP_FEE_MODE = 'free';
    delete process.env.GROM_JUP_FEE_ACCOUNTS_JSON;
    delete process.env.GROM_JUP_FEE_OWNER;
    delete process.env.SOLANA_RPC_URL;

    resetJupFeeCachesForTests();
    config = (await import('../src/config/index.js')).default;
    config.liquidity.jupiterFeeMode = 'free';
    config.liquidity.jupiterFeeAccountsJson = '';
    config.liquidity.jupiterFeeOwner = '';
    config.liquidity.solanaRpcUrl = '';

    prevFetch = globalThis.fetch;
    calls = [];
    globalThis.fetch = async (url, init = {}) => {
      const u = String(url);
      if (u.includes('127.0.0.1') && !u.includes('8899-mock')) return prevFetch(url, init);
      const body = init.body ? String(init.body) : '';
      calls.push({ url: u, method: (init.method || 'GET').toUpperCase(), body });
      if (u.includes('jup.ag') && u.includes('/quote')) {
        const qs = new URL(u).searchParams;
        assert.equal(qs.get('platformFeeBps'), null, 'free mode must not send platformFeeBps');
        const quote = liveQuoteFixture({
          inputMint: qs.get('inputMint'),
          outputMint: qs.get('outputMint'),
          amount: qs.get('amount'),
        });
        return { ok: true, status: 200, text: async () => JSON.stringify(quote), json: async () => quote };
      }
      if (u.includes('jup.ag') && u.includes('/swap')) {
        const parsed = JSON.parse(body || '{}');
        assert.equal(parsed.feeAccount, undefined, 'free mode must not send feeAccount');
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ swapTransaction: 'base64tx', lastValidBlockHeight: 1 }),
          json: async () => ({ swapTransaction: 'base64tx', lastValidBlockHeight: 1 }),
        };
      }
      return { ok: false, status: 500, text: async () => 'nope', json: async () => ({}) };
    };

    const { default: createWalletRouter } = await import('../src/wallet/routes.js');
    const app = express();
    app.use(express.json());
    app.use('/api', createWalletRouter({ requireAuth: (_r, res) => res.status(401).json({ error: 'auth_required' }) }));
    /* public-config shape */
    app.get('/api/swap/public-config', (_req, res) => {
      const jupCfg = { liquidity: config.liquidity };
      res.json({
        feeBps: 20,
        jupiterFeeMode: jupFeeModeFromConfig(jupCfg),
        jupiterFeeEnabled: jupiterFeeEnabled(jupCfg),
        jupiterFeeBps: jupFeeBpsFromConfig(jupCfg),
        aggregators: { jupiter: jupiterEnabled(jupCfg) },
      });
    });
    server = createServer(app);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    globalThis.fetch = prevFetch;
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

  it('public-config: enabled true, feeEnabled false, feeBps 0', async () => {
    const res = await fetch(`${baseUrl}/api/swap/public-config`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.aggregators.jupiter, true);
    assert.equal(body.jupiterFeeEnabled, false);
    assert.equal(body.jupiterFeeBps, 0);
    assert.equal(body.jupiterFeeMode, 'free');
  });

  it('quote works without fee infra; no platformFeeBps upstream', async () => {
    calls.length = 0;
    const res = await fetch(
      `${baseUrl}/api/wallet/jup-quote?inputMint=${SOL}&outputMint=${USDC}&amount=1000000&slippageBps=50`
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body._gromFeeBps, 0);
    assert.equal(body._gromFeeMode, 'free');
    assert.equal(body._gromFeeAccount, undefined);
    assert.ok(body.outAmount);
    assert.equal(calls.filter((c) => c.url.includes('jup.ag')).length, 1);
  });

  it('swap works without feeAccount', async () => {
    calls.length = 0;
    const quote = liveQuoteFixture({ inputMint: SOL, outputMint: USDC, amount: '1000000' });
    const res = await fetch(`${baseUrl}/api/wallet/jup-swap`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userPublicKey: USER, quoteResponse: quote }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.swapTransaction);
    assert.equal(body._gromFeeMode, 'free');
    assert.equal(body._gromFeeAccount, undefined);
  });
});

describe('GROM_JUP_FEE_MODE route fee partial → 503', () => {
  let server;
  let baseUrl;
  let prevFetch;
  let jupCalls;
  let prevEnv;
  let config;

  before(async () => {
    prevEnv = {
      GROM_JUP_FEE_MODE: process.env.GROM_JUP_FEE_MODE,
      GROM_JUP_FEE_ACCOUNTS_JSON: process.env.GROM_JUP_FEE_ACCOUNTS_JSON,
      GROM_JUP_FEE_OWNER: process.env.GROM_JUP_FEE_OWNER,
      SOLANA_RPC_URL: process.env.SOLANA_RPC_URL,
    };
    process.env.GROM_JUP_FEE_MODE = 'fee';
    process.env.GROM_JUP_FEE_ACCOUNTS_JSON = JSON.stringify({ [USDC]: FEE_USDC, [SOL]: FEE_SOL });
    process.env.GROM_JUP_FEE_OWNER = FEE_OWNER;
    /* intentionally no RPC */
    delete process.env.SOLANA_RPC_URL;

    resetJupFeeCachesForTests();
    config = (await import('../src/config/index.js')).default;
    config.liquidity.jupiterFeeMode = 'fee';
    config.liquidity.jupiterFeeAccountsJson = process.env.GROM_JUP_FEE_ACCOUNTS_JSON;
    config.liquidity.jupiterFeeOwner = FEE_OWNER;
    config.liquidity.solanaRpcUrl = '';

    prevFetch = globalThis.fetch;
    jupCalls = 0;
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      if (u.includes('127.0.0.1')) return prevFetch(url, init);
      if (u.includes('jup.ag')) jupCalls += 1;
      return { ok: false, status: 500, text: async () => 'nope', json: async () => ({}) };
    };

    const { default: createWalletRouter } = await import('../src/wallet/routes.js');
    const app = express();
    app.use(express.json());
    app.use('/api', createWalletRouter({ requireAuth: (_r, res) => res.status(401).json({ error: 'auth_required' }) }));
    app.get('/api/swap/public-config', (_req, res) => {
      const jupCfg = { liquidity: config.liquidity };
      res.json({
        jupiterFeeMode: jupFeeModeFromConfig(jupCfg),
        jupiterFeeEnabled: jupiterFeeEnabled(jupCfg),
        jupiterFeeBps: jupFeeBpsFromConfig(jupCfg),
        aggregators: { jupiter: jupiterEnabled(jupCfg) },
      });
    });
    server = createServer(app);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    globalThis.fetch = prevFetch;
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

  it('public-config jupiter false without RPC', async () => {
    const res = await fetch(`${baseUrl}/api/swap/public-config`);
    const body = await res.json();
    assert.equal(body.aggregators.jupiter, false);
    assert.equal(body.jupiterFeeEnabled, false);
    assert.equal(body.jupiterFeeMode, 'fee');
  });

  it('quote 503 and never calls Jupiter', async () => {
    jupCalls = 0;
    const res = await fetch(
      `${baseUrl}/api/wallet/jup-quote?inputMint=${SOL}&outputMint=${USDC}&amount=1000000&slippageBps=50`
    );
    assert.equal(res.status, 503);
    assert.equal(jupCalls, 0);
  });
});

describe('GROM_JUP_FEE_MODE unset → 503', () => {
  let server;
  let baseUrl;
  let prevFetch;
  let jupCalls;
  let prevEnv;
  let config;

  before(async () => {
    prevEnv = { GROM_JUP_FEE_MODE: process.env.GROM_JUP_FEE_MODE };
    delete process.env.GROM_JUP_FEE_MODE;
    resetJupFeeCachesForTests();
    config = (await import('../src/config/index.js')).default;
    config.liquidity.jupiterFeeMode = '';

    prevFetch = globalThis.fetch;
    jupCalls = 0;
    globalThis.fetch = async (url, init) => {
      if (String(url).includes('127.0.0.1')) return prevFetch(url, init);
      if (String(url).includes('jup.ag')) jupCalls += 1;
      return { ok: false, status: 500, text: async () => 'x', json: async () => ({}) };
    };

    const { default: createWalletRouter } = await import('../src/wallet/routes.js');
    const app = express();
    app.use(express.json());
    app.use('/api', createWalletRouter({ requireAuth: (_r, res) => res.status(401).json({ error: 'auth_required' }) }));
    server = createServer(app);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    globalThis.fetch = prevFetch;
    if (prevEnv.GROM_JUP_FEE_MODE === undefined) delete process.env.GROM_JUP_FEE_MODE;
    else process.env.GROM_JUP_FEE_MODE = prevEnv.GROM_JUP_FEE_MODE;
    if (server) {
      await new Promise((r) => server.close(r));
      server.closeAllConnections?.();
    }
    try {
      const { pool } = await import('../src/db/pool.js');
      await pool.end().catch(() => {});
    } catch (_) {}
  });

  it('quote 503 when mode unset', async () => {
    jupCalls = 0;
    const res = await fetch(
      `${baseUrl}/api/wallet/jup-quote?inputMint=${SOL}&outputMint=${USDC}&amount=1000000&slippageBps=50`
    );
    assert.equal(res.status, 503);
    assert.equal(jupCalls, 0);
  });
});
