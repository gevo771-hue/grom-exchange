/**
 * RR6-05 — Jupiter fee account on-chain verification (fail-closed).
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  resetJupFeeCachesForTests,
  verifyJupFeeTokenAccount,
  jupiterFeeReady,
  resolveJupFeeAccount,
  TOKEN_PROGRAM,
  TOKEN_2022_PROGRAM,
} from '../src/wallet/jup-fee.js';

const MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const ACCT = 'GromUsdcFeeAcct111111111111111111111111111';
const OWNER = 'GromFeeAuth111111111111111111111111111111';
const RPC = 'http://rpc.test/solana';

function mockRpc(value) {
  return async () => ({
    ok: true,
    json: async () => ({ result: { value } }),
  });
}

describe('RR6 Jupiter fee account RPC verification', () => {
  beforeEach(() => resetJupFeeCachesForTests());

  it('missing RPC → false (never trust map alone)', async () => {
    const ok = await verifyJupFeeTokenAccount(ACCT, MINT, { expectedOwner: OWNER, rpcUrl: '' });
    assert.equal(ok, false);
  });

  it('nonexistent account → false', async () => {
    const ok = await verifyJupFeeTokenAccount(ACCT, MINT, {
      expectedOwner: OWNER,
      rpcUrl: RPC,
      fetchImpl: mockRpc(null),
    });
    assert.equal(ok, false);
  });

  it('wrong program owner → false', async () => {
    const ok = await verifyJupFeeTokenAccount(ACCT, MINT, {
      expectedOwner: OWNER,
      rpcUrl: RPC,
      fetchImpl: mockRpc({
        owner: '11111111111111111111111111111111',
        data: { parsed: { info: { mint: MINT, owner: OWNER } } },
      }),
    });
    assert.equal(ok, false);
  });

  it('missing parsed mint → false', async () => {
    const ok = await verifyJupFeeTokenAccount(ACCT, MINT, {
      expectedOwner: OWNER,
      rpcUrl: RPC,
      fetchImpl: mockRpc({
        owner: TOKEN_PROGRAM,
        data: { parsed: { info: { owner: OWNER } } },
      }),
    });
    assert.equal(ok, false);
  });

  it('wrong mint → false', async () => {
    const ok = await verifyJupFeeTokenAccount(ACCT, MINT, {
      expectedOwner: OWNER,
      rpcUrl: RPC,
      fetchImpl: mockRpc({
        owner: TOKEN_PROGRAM,
        data: { parsed: { info: { mint: 'So11111111111111111111111111111111111111112', owner: OWNER } } },
      }),
    });
    assert.equal(ok, false);
  });

  it('wrong authority → false', async () => {
    const ok = await verifyJupFeeTokenAccount(ACCT, MINT, {
      expectedOwner: OWNER,
      rpcUrl: RPC,
      fetchImpl: mockRpc({
        owner: TOKEN_2022_PROGRAM,
        data: { parsed: { info: { mint: MINT, owner: 'WrongAuth111111111111111111111111111111' } } },
      }),
    });
    assert.equal(ok, false);
  });

  it('correct account → true', async () => {
    const ok = await verifyJupFeeTokenAccount(ACCT, MINT, {
      expectedOwner: OWNER,
      rpcUrl: RPC,
      fetchImpl: mockRpc({
        owner: TOKEN_PROGRAM,
        data: { parsed: { info: { mint: MINT, owner: OWNER } } },
      }),
    });
    assert.equal(ok, true);
  });

  it('jupiterFeeReady requires map + owner + rpc', () => {
    assert.equal(jupiterFeeReady({ liquidity: {} }), false);
    assert.equal(jupiterFeeReady({
      liquidity: {
        jupiterFeeAccountsJson: JSON.stringify({ [MINT]: ACCT }),
        jupiterFeeOwner: OWNER,
        solanaRpcUrl: '',
      },
    }), false);
    assert.equal(jupiterFeeReady({
      liquidity: {
        jupiterFeeAccountsJson: JSON.stringify({ [MINT]: ACCT }),
        jupiterFeeOwner: OWNER,
        solanaRpcUrl: RPC,
      },
    }), true);
  });

  it('resolveJupFeeAccount null without rpc', async () => {
    const cfg = {
      liquidity: {
        jupiterFeeAccountsJson: JSON.stringify({ [MINT]: ACCT }),
        jupiterFeeOwner: OWNER,
        solanaRpcUrl: '',
      },
    };
    const r = await resolveJupFeeAccount(cfg, MINT, 'So11111111111111111111111111111111111111112');
    assert.equal(r, null);
  });
});
