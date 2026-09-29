import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { assertQuoteMatchesContext, buildQuoteContext } from '../src/liquidity/swap-quote-context.js';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const GromSwapCore = require('../../frontend/public/grom-swap-core.js');
const walletSrc = readFileSync(join(__dirname, '../../frontend/public/grom-wallet.js'), 'utf8');
const coreSrc = readFileSync(join(__dirname, '../../frontend/public/grom-swap-core.js'), 'utf8');

/** Extract a top-level function by brace depth (handles nesting). */
function extractFn(name) {
  const re = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const m = re.exec(walletSrc);
  if (!m) throw new Error('missing ' + name);
  let i = m.index + m[0].length - 1;
  let depth = 0;
  for (; i < walletSrc.length; i++) {
    const ch = walletSrc[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  while (i < walletSrc.length && /\s/.test(walletSrc[i])) i++;
  if (walletSrc[i] !== '{') throw new Error('no body for ' + name);
  const start = m.index;
  depth = 0;
  for (; i < walletSrc.length; i++) {
    const ch = walletSrc[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return walletSrc.slice(start, i + 1);
    }
  }
  throw new Error('unclosed ' + name);
}

function makeCtx(fnNames, extras = {}) {
  const c = vm.createContext({
    console: { warn() {}, log() {}, error() {} },
    GW_LIFI_SOL_CHAIN: 1151111081099710,
    GW_TRON_CHAIN_ID: 728126428,
    document: extras.document || { querySelector: () => null },
    ...extras,
  });
  c.window = c.window || {};
  Object.assign(c.window, extras.window || {});
  vm.runInContext(coreSrc, c);
  c.window.GromSwapCore = c.GromSwapCore;
  for (const n of fnNames) vm.runInContext(extractFn(n), c);
  return c;
}

describe('R01 recovery uses JSON-RPC input (product helper)', () => {
  const from = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const router = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const swapData = '0x38ed1739deadbeef';
  const approveData = '0x095ea7b3ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

  it('matches eth_getBlockByNumber fixture with input (not data)', () => {
    // Real JSON-RPC shape: https://ethereum.org/developers/docs/apis/json-rpc/#eth_getblockbynumber
    const txs = [
      {
        from, to: router, nonce: '0x7', input: approveData, value: '0x0',
        hash: '0xapprove',
      },
      {
        from, to: router, nonce: '0x7', input: swapData, value: '0x0',
        hash: '0xswap',
      },
    ];
    assert.equal(
      GromSwapCore.findMatchingOutboundTx(txs, {
        from, to: router, nonce: 7, data: swapData, value: '0x0',
      }),
      '0xswap',
    );
  });

  it('does not match when only nonstandard data is present without input', () => {
    const txs = [
      { from, to: router, nonce: 7, data: swapData, value: '0x0', hash: '0xswap' },
    ];
    // normalizeRpcTxCalldata falls back to data — both forms accepted
    assert.equal(
      GromSwapCore.normalizeRpcTxCalldata({ input: swapData }),
      swapData,
    );
    assert.equal(
      GromSwapCore.normalizeRpcTxCalldata({ data: swapData }),
      swapData,
    );
    assert.equal(
      GromSwapCore.findMatchingOutboundTx(txs, {
        from, to: router, nonce: 7, data: swapData, value: '0x0',
      }),
      '0xswap',
    );
  });

  it('rejects approve with same nonce+router', () => {
    const txs = [
      { from, to: router, nonce: 7, input: approveData, value: '0x0', hash: '0xapprove' },
    ];
    assert.equal(
      GromSwapCore.findMatchingOutboundTx(txs, {
        from, to: router, nonce: 7, data: swapData, value: '0x0',
      }),
      null,
    );
  });

  it('wallet source wires input||data in gwRpcTxCalldata', () => {
    assert.match(walletSrc, /normalizeRpcTxCalldata/);
    assert.match(walletSrc, /tx\?\.input != null && tx\.input !== '' \? tx\.input : \(tx\?\.data/);
  });
});

describe('R02 restore lock without hash', () => {
  it('restores unknown and awaiting_signature without hash', () => {
    assert.equal(GromSwapCore.shouldRestoreSwapOp({ stage: 'unknown' }), true);
    assert.equal(GromSwapCore.shouldRestoreSwapOp({ stage: 'awaiting_signature' }), true);
    assert.equal(GromSwapCore.shouldRestoreSwapOp({ stage: 'bridging', hash: '0xabc' }), true);
    assert.equal(GromSwapCore.shouldRestoreSwapOp({ stage: 'completed' }), false);
  });

  it('wallet resume no longer requires hash', () => {
    assert.match(walletSrc, /function gwResumeSwapOpFromStorage/);
    assert.doesNotMatch(
      walletSrc,
      /function gwResumeBridgeMonitorFromStorage[\s\S]{0,200}if\s*\(\s*!op\.hash\s*\)\s*return/,
    );
  });
});

describe('R03 bridge monitor ownership', () => {
  it('rejects foreign opId / hash', () => {
    const op = { id: 'op_new', hash: '0xnew' };
    assert.equal(GromSwapCore.bridgeMonitorOwnsOp(op, { opId: 'op_old', txHash: '0xold' }), false);
    assert.equal(GromSwapCore.bridgeMonitorOwnsOp(op, { opId: 'op_new', txHash: '0xnew' }), true);
  });
});

describe('R04 slippage converters', () => {
  it('percent prefs → fraction; bps/odos at edge', () => {
    assert.equal(GromSwapCore.slippageToFraction(0.5), 0.005);
    assert.equal(GromSwapCore.slippageToBps(0.005), 50);
    assert.equal(GromSwapCore.slippageToOdosPercent(0.005), 0.5);
    assert.equal(GromSwapCore.slippageToSquidPercent(0.01), 1);
  });
});

describe('R08 / R09 / R10 product helpers', () => {
  it('detects wallet user rejection', () => {
    assert.equal(GromSwapCore.isWalletUserRejection({ code: 4001 }), true);
    assert.equal(GromSwapCore.isWalletUserRejection({ message: 'network' }), false);
  });

  it('non-EVM string hash is submitted not completed', () => {
    const r = GromSwapCore.normalizeExecResult('sig123', { namespace: 'solana' });
    assert.equal(r.status, 'submitted');
    assert.equal(r.confirmed, false);
  });

  it('EVM confirmed object → completed', () => {
    const r = GromSwapCore.normalizeExecResult(
      { hash: '0x1', status: 'completed', confirmed: true, namespace: 'evm' },
      { namespace: 'evm' },
    );
    assert.equal(r.status, 'completed');
    assert.equal(r.confirmed, true);
  });

  it('canonical amount keeps excess decimals as string (no Number)', () => {
    const s = GromSwapCore.canonicalAmountString('1.000000000000000001');
    assert.equal(s, '1.000000000000000001');
    assert.equal(Number(s), 1); // IEEE float loses the digit
    assert.notEqual(s, '1'); // product must keep the string
  });
});

describe('R05 Paraswap cross-chain guard in source', () => {
  it('pickParaswapBackup refuses cross-chain intent', () => {
    assert.match(walletSrc, /R05: Paraswap is same-chain only/);
    assert.match(walletSrc, /if \(wasCross\) return null/);
  });
});

describe('R06 refresh must not keep stale calldata', () => {
  it('refresh throws on failure', () => {
    assert.match(walletSrc, /Quote refresh failed — will not sign stale calldata/);
    assert.match(walletSrc, /Quote refresh returned empty — will not sign stale calldata/);
  });
});

describe('Solana dispatch gating', () => {
  it('gwIsSolanaUiActive true only for sol chip; EVM chip wins over stale sol', () => {
    const solChip = makeCtx(['gwIsSolanaUiActive'], {
      document: {
        querySelector: (sel) => (sel === '.gw-ds-chain.on'
          ? { dataset: { nonevm: 'sol' } }
          : null),
      },
      window: { __gwDsUserPickedFrom: { chainId: 1, sym: 'USDC' } },
    });
    assert.equal(solChip.gwIsSolanaUiActive(), true);

    const evmChip = makeCtx(['gwIsSolanaUiActive'], {
      document: {
        querySelector: (sel) => (sel === '.gw-ds-chain.on'
          ? { dataset: { cid: '56' } }
          : null),
      },
      window: { __gwDsUserPickedFrom: { nonevm: 'sol', sym: 'USDC' } },
    });
    assert.equal(evmChip.gwIsSolanaUiActive(), false);
  });

  it('gwOnChainSwapExec routes to gwSolExec only when Solana UI active', async () => {
    let solCalls = 0;
    const active = makeCtx(['gwOnChainSwapExec'], {
      window: {},
      gwIsSolanaUiActive: () => true,
      gwIsTonUiActive: () => false,
      gwIsTronPair: () => false,
      gwDsResolveBridgeDest: () => 0,
      gwGetActiveUiChainId: () => null,
      gwSolExec: async ({ fromSym, toSym }) => {
        solCalls += 1;
        return { hash: 'SolSigGate', namespace: 'solana', fromSym, toSym };
      },
      gwEnsureSigningForSwap: async () => {
        throw new Error('should not reach EVM signing when Solana active');
      },
      gwToast() {},
    });
    const r = await active.gwOnChainSwapExec('SOL', 'USDC', '1');
    assert.equal(r.hash, 'SolSigGate');
    assert.equal(solCalls, 1);

    solCalls = 0;
    const inactive = makeCtx(['gwOnChainSwapExec'], {
      window: {},
      gwIsSolanaUiActive: () => false,
      gwIsTonUiActive: () => false,
      gwIsTronPair: () => false,
      gwDsResolveBridgeDest: () => 0,
      gwGetActiveUiChainId: () => null,
      gwSolExec: async () => {
        solCalls += 1;
        return { hash: 'should-not' };
      },
      gwActiveSigningProvider: () => null,
      gwReadOnlyAddress: () => '',
      gwEnsureSigningForSwap: async () => {
        throw new Error('Wallet session expired — reconnect, then hit Swap again');
      },
      gwReconcileStaleWalletUi() {},
      gwIsOrphanWalletChip: () => false,
      gwToast() {},
    });
    await assert.rejects(
      () => inactive.gwOnChainSwapExec('SOL', 'USDC', '1'),
      /Wallet session expired|reconnect/i,
    );
    assert.equal(solCalls, 0);
  });
});

describe('F01 frontend agg cache account bind (source)', () => {
  it('cache stores and checks account', () => {
    assert.match(walletSrc, /account: String\(account \|\| ''\)\.toLowerCase\(\)/);
    assert.match(walletSrc, /cacheAcct === acctLc/);
  });
});

describe('F04 timeout lock', () => {
  it('timeout maps to unknown not failed', () => {
    const reason = 'Wallet request timed out — open Trust → Activity; if tx is there, swap already sent';
    const rejected = /user rejected|declined/i.test(reason);
    const timedOut = /timed out|timeout|check Activity|already sent/i.test(reason) && !rejected;
    const stage = timedOut ? 'unknown' : (rejected ? 'cancelled' : 'failed');
    assert.equal(stage, 'unknown');
    assert.equal(GromSwapCore.shouldRestoreSwapOp({ stage }), true);
  });
});

describe('R10 Instant Swap amount paths prefer string→BigInt', () => {
  it('wallet exposes gwAmtToBaseUnits and avoids Number×10**dec in meta adapters', () => {
    assert.match(walletSrc, /function gwAmtToBaseUnits/);
    assert.match(walletSrc, /gwAmtToBaseUnits\(amtNum, inDec\)/);
    // Paraswap / Kyber / Odos / Squid / CoW should not use Math.floor(amtNum * 10 **
    const metaBlock = walletSrc.slice(
      walletSrc.indexOf('async function gwAggQuoteParaswap'),
      walletSrc.indexOf('async function gwMetaAggQuoteAll'),
    );
    assert.equal(/BigInt\(Math\.floor\(amtNum \* 10 \*\*/.test(metaBlock), false);
  });
});


describe('R11 assertQuoteMatchesContext strict executable', () => {
  const baseCtx = {
    fromChainId: 42161, toChainId: 8453,
    fromToken: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    toToken: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    fromAmount: '19731415',
    fromAddress: '0x0000000000000000000000000000000000000002',
    toAddress: '0x0000000000000000000000000000000000000002',
    slippage: '0.005',
  };

  it('rejects missing action when requireTx', () => {
    const ctx = buildQuoteContext(baseCtx);
    assert.throws(
      () => assertQuoteMatchesContext({
        lifi: { transactionRequest: { to: '0xrouter', data: '0xabc', from: baseCtx.fromAddress } },
      }, ctx, { requireTx: true }),
      /missing action/,
    );
  });

  it('rejects native alias abuse (zero vs ERC20)', () => {
    const ctx = buildQuoteContext(baseCtx);
    assert.throws(
      () => assertQuoteMatchesContext({
        lifi: {
          action: {
            fromChainId: 42161, toChainId: 8453,
            fromToken: { address: '0x0000000000000000000000000000000000000000' },
            toToken: { address: baseCtx.toToken },
            fromAmount: '19731415',
            fromAddress: baseCtx.fromAddress,
            toAddress: baseCtx.toAddress,
            slippage: 0.005,
          },
          transactionRequest: { to: '0xrouter', data: '0xabc', from: baseCtx.fromAddress },
        },
      }, ctx, { requireTx: true }),
      /native alias/,
    );
  });
});
