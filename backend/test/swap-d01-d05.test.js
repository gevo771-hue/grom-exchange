import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { normalizeAxelarGmpStatus } from '../src/market/axelar-gmp.js';
import { axelarPayload, squidReceipt, swapOp, sourceHash, destinationHash } from './fixtures/axelar-squid.js';

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
  let i = m.index + m[0].length - 1; // at '('
  // skip params
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
      if (depth === 0) {
        return walletSrc.slice(start, i + 1);
      }
    }
  }
  throw new Error('unclosed ' + name);
}

function makeCtx(fnNames, extras = {}) {
  const storage = extras._storage || {};
  const localStorage = extras.localStorage || {
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => {
      storage[k] = String(v);
    },
    removeItem: (k) => {
      delete storage[k];
    },
  };
  const c = vm.createContext({
    console: { warn() {}, log() {}, error() {} },
    URLSearchParams,
    Date,
    // Extracted wallet fns (e.g. gwDsSubmit) reference these file-scope consts.
    GW_LIFI_SOL_CHAIN: 1151111081099710,
    GW_TRON_CHAIN_ID: 728126428,
    setTimeout: (fn, ms) => {
      const id = setTimeout(fn, ms || 0);
      return id;
    },
    clearTimeout,
    fetch: extras.fetch || (async () => ({ json: async () => ({}) })),
    localStorage,
    document: extras.document || {
      getElementById: () => ({
        value: '1',
        classList: { add() {}, remove() {}, contains() { return false; } },
      }),
      querySelector: () => null,
      body: { appendChild() {} },
    },
    ...extras,
  });
  c.window = c.window || {};
  Object.assign(c.window, extras.window || {});
  vm.runInContext(coreSrc, c);
  c.window.GromSwapCore = c.GromSwapCore;
  for (const n of fnNames) {
    vm.runInContext(extractFn(n), c);
  }
  c._storage = storage;
  return c;
}

function flush(ms = 30) {
  return new Promise((r) => setTimeout(r, ms));
}

describe('D01 typed unknown classification', () => {
  it('SOLANA_SEND_UNKNOWN → unknown + keepLock (ignores Phantom wording gap)', () => {
    const e = new Error('Solana send result unknown — check Phantom Activity before retrying');
    e.code = 'SOLANA_SEND_UNKNOWN';
    const c = GromSwapCore.classifySwapExecError(e);
    assert.equal(c.kind, 'unknown');
    assert.equal(c.keepLock, true);
    assert.equal(c.stage, 'unknown');
  });

  it('network message without timedOut regex still unknown via code', () => {
    const e = new Error('network disconnected after broadcast');
    e.code = 'SOLANA_SEND_UNKNOWN';
    assert.equal(GromSwapCore.classifySwapExecError(e).stage, 'unknown');
  });

  it('empty signature code → unknown', () => {
    const e = new Error('empty');
    e.code = 'SOLANA_EMPTY_SIGNATURE';
    assert.equal(GromSwapCore.classifySwapExecError(e).kind, 'unknown');
  });

  it('user reject → cancelled', () => {
    const e = new Error('User rejected the request');
    e.code = 4001;
    assert.equal(GromSwapCore.classifySwapExecError(e).kind, 'cancelled');
  });

  it('policy second attempt network → SOLANA_SEND_UNKNOWN not raw throw', async () => {
    let calls = 0;
    const provider = {
      async signAndSendTransaction() {
        calls += 1;
        if (calls === 1) throw new Error('Unexpected type: expected VersionedTransaction');
        throw new Error('network disconnected on retry');
      },
    };
    await assert.rejects(
      () => GromSwapCore.solSignAndSendWithPolicy(provider, { kind: 'tx' }),
      (err) => err && err.code === 'SOLANA_SEND_UNKNOWN',
    );
    assert.equal(calls, 2);
  });

  it('gwDsSubmit + real policy: network → stage unknown, lock kept', async () => {
    let c;
    const storage = {};
    c = makeCtx(
      ['gwSwapOpGet', 'gwSwapOpBegin', 'gwSwapOpUpdate', 'gwSwapOpClear', 'gwSwapOpIsActive', 'gwSwapWalletActionPending', 'gwDsSubmit'],
      {
        _storage: storage,
        window: { __gwDsQuoteExecReady: true },
        gwDsLang: () => ({}),
        gwDsGetMode: () => 'onchain',
        gwDsNormSym: (s) => s,
        gwDsReadSwapAmtStr: () => '1',
        gwDsEnsureSameAssetBridge() {},
        gwDsSameAssetBridgeAllowed: () => false,
        gwToast() {},
        gwDsPushRecent() {},
        gwDsFlashSuccess() {},
        gwDsResetSubmitState() {},
      gwHideRemoteSignCoach() {},
      gromReportIssue() {},
      gwOnChainSwapExec: async () => {
          // A dispatched wallet request can still become ambiguous without a tx hash.
          c.gwSwapOpUpdate({
            stage: 'awaiting_signature',
            requestDispatched: true,
            walletRequestAt: Date.now(),
          });
          return GromSwapCore.solSignAndSendWithPolicy(
            {
              async signAndSendTransaction() {
                throw new Error('network disconnected after broadcast');
              },
            },
            {},
          );
        },
        document: {
          getElementById: (id) => ({
            value: id === 'gwDsFrom' ? 'SOL' : id === 'gwDsTo' ? 'USDC' : '1',
            classList: { add() {}, remove() {} },
          }),
        },
      },
    );
    await c.gwDsSubmit();
    assert.equal(c.window.__gwSwapOp?.stage, 'unknown');
    assert.ok(storage.gw_swap_op, 'active op must remain persisted');
    assert.equal(c.gwDsSubmit._busy, true);
    assert.equal(JSON.parse(storage.gw_swap_op).stage, 'unknown');
    assert.equal(JSON.parse(storage.gw_swap_op).hash, null);
    assert.equal(JSON.parse(storage.gw_swap_op).requestDispatched, true);
  });

  it('route preparation timeout before wallet dispatch clears the stale operation instead of locking swaps', async () => {
    const storage = {};
    const issues = [];
    const toasts = [];
    const c = makeCtx(
      ['gwSwapOpGet', 'gwSwapOpBegin', 'gwSwapOpUpdate', 'gwSwapOpClear', 'gwSwapOpIsActive', 'gwSwapWalletActionPending', 'gwDsSubmit'],
      {
        _storage: storage,
        window: { __gwDsQuoteExecReady: true },
        gwDsLang: () => ({}),
        gwDsGetMode: () => 'onchain',
        gwDsNormSym: (s) => s,
        gwDsReadSwapAmtStr: () => '1',
        gwDsResolveQuoteAccount: () => '0x1234567890123456789012345678901234567890',
        gwDsEnsureSameAssetBridge() {},
        gwDsSameAssetBridgeAllowed: () => false,
        gwToast: (message, kind) => toasts.push({ message, kind }),
        gwDsPushRecent() {},
        gwDsFlashSuccess() {},
        gwDsResetSubmitState() {},
        gwHideRemoteSignCoach() {},
        gromSwapClearAwaitingWallet() {},
        gromReportIssue: (issue) => issues.push(issue),
        gwUxText: (_ru, en) => en,
        gwOnChainSwapExec: async () => {
          throw Object.assign(new Error('Route quote timeout during preparation'), { code: 'ETIMEDOUT' });
        },
        document: {
          getElementById: (id) => ({
            value: id === 'gwDsFrom' ? 'USDC' : id === 'gwDsTo' ? 'ETH' : '1',
            classList: { add() {}, remove() {}, contains() { return false; } },
          }),
          querySelectorAll: () => [],
        },
      },
    );

    await c.gwDsSubmit();

    assert.equal(c.window.__gwSwapOp, null);
    assert.equal(c.gwDsSubmit._busy, false);
    assert.equal(storage.gw_swap_op, undefined);
    assert.equal(issues[0]?.action, 'swap_failed');
    assert.equal(issues[0]?.detail?.kind, 'preflight_failed');
    assert.equal(issues[0]?.detail?.requestDispatched, false);
    assert.match(toasts[0]?.message || '', /before a wallet request was sent/i);
  });
});

describe('D02 submitted stays active until terminal', () => {
  it('shouldClearSwapOpAfterSubmit false for submitted/unknown', () => {
    assert.equal(GromSwapCore.shouldClearSwapOpAfterSubmit('submitted'), false);
    assert.equal(GromSwapCore.shouldClearSwapOpAfterSubmit('unknown'), false);
    assert.equal(GromSwapCore.shouldClearSwapOpAfterSubmit('completed'), true);
    assert.equal(GromSwapCore.shouldClearSwapOpAfterSubmit('failed'), true);
  });

  it('gwDsSubmit Solana submitted: active+busy+monitor; deferred RPC then completed', async () => {
    let resolveRpc;
    const rpcBody = new Promise((r) => {
      resolveRpc = r;
    });
    let monitorStarted = false;
    const storage = {};
    const c = makeCtx(
      [
        'gwSwapOpGet',
        'gwSwapOpBegin',
        'gwSwapOpUpdate',
        'gwSwapOpClear',
        'gwSwapOpIsActive',
        'gwSwapWalletActionPending',
        'gwMonitorTerminal',
        'gwSolConfirmMonitor',
        'gwDsSubmit',
      ],
      {
        _storage: storage,
        window: { __gwDsQuoteExecReady: true },
        fetch: async () => ({
          json: async () => rpcBody,
        }),
        gwDsLang: () => ({}),
        gwDsGetMode: () => 'onchain',
        gwDsNormSym: (s) => s,
        gwDsReadSwapAmtStr: () => '1',
        gwDsEnsureSameAssetBridge() {},
        gwDsSameAssetBridgeAllowed: () => false,
        gwToast() {},
        gwDsPushRecent() {},
        gwDsFlashSuccess() {},
        gwDsResetSubmitState() {},
        gwHideRemoteSignCoach() {},
        gromReportIssue() {},
        gwOnChainSwapExec: async () => {
          monitorStarted = true;
          return { hash: 'SolSig111', namespace: 'solana', status: 'submitted' };
        },
        // let real gwSolConfirmMonitor run (injected via extract)
        document: {
          getElementById: (id) => ({
            value: id === 'gwDsFrom' ? 'SOL' : id === 'gwDsTo' ? 'USDC' : '1',
            classList: { add() {}, remove() {} },
          }),
          querySelector: () => null,
        },
      },
    );
    // Prefer real monitor from ctx — override stub flag via wrapping
    const realMon = c.gwSolConfirmMonitor;
    c.gwSolConfirmMonitor = (args) => {
      monitorStarted = true;
      return realMon(args);
    };

    const submitDone = c.gwDsSubmit();
    await submitDone;
    assert.equal(c.window.__gwSwapOp?.stage, 'submitted');
    assert.ok(storage.gw_swap_op, 'D02: gw_swap_op must remain');
    assert.equal(c.gwDsSubmit._busy, true);
    assert.equal(monitorStarted, true);

    // Deferred RPC after submit returned
    resolveRpc({
      result: {
        context: { slot: 1 },
        value: [{ err: null, confirmationStatus: 'finalized' }],
      },
    });
    await flush(80);
    assert.equal(c.window.__gwSwapOp, null);
    assert.equal(c.gwDsSubmit._busy, false);
    assert.ok(!storage.gw_swap_op);
    assert.equal(JSON.parse(storage.gw_swap_op_last).stage, 'completed');
  });

  it('reload resume reads gw_swap_op and restarts sol monitor', async () => {
    let resumed = null;
    const op = {
      id: 'op_reload',
      stage: 'submitted',
      namespace: 'solana',
      hash: 'SigReload',
      startedAt: Date.now(),
    };
    const c = makeCtx(['gwResumeSwapOpFromStorage'], {
      localStorage: {
        getItem: (k) => (k === 'gw_swap_op' ? JSON.stringify(op) : null),
        setItem() {},
        removeItem() {},
      },
      gwSolConfirmMonitor: (p) => {
        resumed = p;
      },
      gwLifiBridgeMonitor() {
        throw new Error('must not call lifi');
      },
      gwToast() {},
      gwDsSubmit() {},
      document: {
        getElementById: () => ({ classList: { add() {}, remove() {} } }),
      },
    });
    c.gwResumeSwapOpFromStorage();
    assert.equal(c.window.__gwSwapOp?.id, 'op_reload');
    assert.equal(resumed?.signature, 'SigReload');
    assert.equal(c.gwDsSubmit._busy, false, 'a submitted transaction is monitored, not a wallet prompt');
  });

  it('reload resumes Squid bridge operations with the Squid monitor', () => {
    let resumed = null;
    const op = {
      id: 'op_squid_reload', stage: 'unknown', namespace: 'evm', hash: '0xabc',
      bridge: 'squid', crossChain: true, chainId: 1, fromChainId: 1, toChainId: 42161,
      quoteId: 'quote-123', startedAt: Date.now(),
    };
    const c = makeCtx(['gwResumeSwapOpFromStorage'], {
      localStorage: {
        getItem: (k) => (k === 'gw_swap_op' ? JSON.stringify(op) : null),
        setItem() {}, removeItem() {},
      },
      gwSquidBridgeMonitor: (p) => { resumed = p; },
      gwLifiBridgeMonitor() { throw new Error('Squid status must not be sent to LI.FI'); },
      gwToast() {}, gwDsSubmit() {},
      document: { getElementById: () => ({ classList: { add() {}, remove() {} } }) },
    });
    c.gwResumeSwapOpFromStorage();
    assert.equal(resumed?.txHash, '0xabc');
    assert.equal(resumed?.fromChainId, 1);
    assert.equal(resumed?.toChainId, 42161);
    assert.equal(resumed?.quoteId, 'quote-123');
    assert.equal(c.gwDsSubmit._busy, false);
  });
});

describe('D03 Solana result.value parse', () => {
  it('official value[0] finalized → completed', () => {
    const p = GromSwapCore.parseSolanaSignatureStatuses({
      result: { context: { slot: 1 }, value: [{ err: null, confirmationStatus: 'finalized' }] },
    });
    assert.equal(p.outcome, 'completed');
  });

  it('null status → pending; err → failed; rpc error', () => {
    assert.equal(
      GromSwapCore.parseSolanaSignatureStatuses({ result: { value: [null] } }).outcome,
      'pending',
    );
    assert.equal(
      GromSwapCore.parseSolanaSignatureStatuses({
        result: { value: [{ err: { InstructionError: [0, 'Custom'] }, confirmationStatus: 'finalized' }] },
      }).outcome,
      'failed',
    );
    assert.equal(
      GromSwapCore.parseSolanaSignatureStatuses({ error: { message: 'rate' } }).outcome,
      'rpc_error',
    );
  });

  it('gwSolConfirmMonitor with result.value finalized → completed + unlock', async () => {
    const storage = {};
    const c = makeCtx(
      ['gwSwapOpGet', 'gwSwapOpUpdate', 'gwSwapOpClear', 'gwMonitorTerminal', 'gwSolConfirmMonitor'],
      {
        _storage: storage,
        window: { __gwSwapOp: { id: 'OP', stage: 'submitted', hash: 'SIG' } },
        fetch: async () => ({
          json: async () => ({
            result: { context: { slot: 1 }, value: [{ err: null, confirmationStatus: 'finalized' }] },
          }),
        }),
        gwToast() {},
        gwDsResetSubmitState() {},
        gwDsSubmit() {},
        document: {
          getElementById: () => ({ classList: { add() {}, remove() {} } }),
        },
      },
    );
    storage.gw_swap_op = JSON.stringify(c.window.__gwSwapOp);
    c.gwDsSubmit._busy = true;
    await c.gwSolConfirmMonitor({ signature: 'SIG', opId: 'OP' });
    await flush(40);
    assert.equal(c.window.__gwSwapOp, null);
    assert.equal(c.gwDsSubmit._busy, false);
    assert.equal(JSON.parse(storage.gw_swap_op_last).stage, 'completed');
  });
});

describe('D04 Tron positive success only', () => {
  it('SUCCESS completed; REVERT/OUT_OF_ENERGY/OUT_OF_TIME failed', () => {
    assert.equal(
      GromSwapCore.classifyTronTxInfo({ id: 'TX', receipt: { result: 'SUCCESS' } }, 'TX').outcome,
      'completed',
    );
    assert.equal(
      GromSwapCore.classifyTronTxInfo({ id: 'TX', receipt: { result: 'REVERT' } }, 'TX').outcome,
      'failed',
    );
    assert.equal(
      GromSwapCore.classifyTronTxInfo({ id: 'TX', receipt: { result: 'OUT_OF_ENERGY' } }, 'TX').outcome,
      'failed',
    );
    assert.equal(
      GromSwapCore.classifyTronTxInfo({ id: 'TX', receipt: { result: 'OUT_OF_TIME' } }, 'TX').outcome,
      'failed',
    );
  });

  it('empty / wrong id / receipt without result', () => {
    assert.equal(GromSwapCore.classifyTronTxInfo({}, 'TX').outcome, 'empty');
    assert.equal(
      GromSwapCore.classifyTronTxInfo({ id: 'OTHER', receipt: { result: 'SUCCESS' } }, 'TX').outcome,
      'mismatch',
    );
    assert.equal(
      GromSwapCore.classifyTronTxInfo({ id: 'TX', receipt: {} }, 'TX').outcome,
      'unknown',
    );
  });

  it('gwTronConfirmMonitor REVERT → failed terminal', async () => {
    const storage = {};
    const c = makeCtx(
      ['gwSwapOpGet', 'gwSwapOpUpdate', 'gwSwapOpClear', 'gwMonitorTerminal', 'gwTronConfirmMonitor'],
      {
        _storage: storage,
        window: { __gwSwapOp: { id: 'OP', stage: 'submitted', hash: 'TX' } },
        fetch: async () => ({
          json: async () => ({ id: 'TX', receipt: { result: 'REVERT' } }),
        }),
        gwToast() {},
        gwDsResetSubmitState() {},
        gwDsSubmit() {},
        document: {
          getElementById: () => ({ classList: { add() {}, remove() {} } }),
        },
      },
    );
    storage.gw_swap_op = JSON.stringify(c.window.__gwSwapOp);
    c.gwDsSubmit._busy = true;
    await c.gwTronConfirmMonitor({ txId: 'TX', opId: 'OP' });
    await flush(40);
    assert.equal(c.window.__gwSwapOp, null);
    assert.equal(JSON.parse(storage.gw_swap_op_last).stage, 'failed');
    assert.equal(c.gwDsSubmit._busy, false);
  });

  it('gwTronConfirmMonitor OUT_OF_ENERGY → failed not completed', async () => {
    const storage = {};
    const c = makeCtx(
      ['gwSwapOpGet', 'gwSwapOpClear', 'gwMonitorTerminal', 'gwTronConfirmMonitor'],
      {
        _storage: storage,
        window: { __gwSwapOp: { id: 'OP', stage: 'submitted', hash: 'TX' } },
        fetch: async () => ({
          json: async () => ({ id: 'TX', receipt: { result: 'OUT_OF_ENERGY' } }),
        }),
        gwToast() {},
        gwDsResetSubmitState() {},
        gwDsSubmit() {},
        document: {
          getElementById: () => ({ classList: { add() {}, remove() {} } }),
        },
      },
    );
    await c.gwTronConfirmMonitor({ txId: 'TX', opId: 'OP' });
    await flush(40);
    assert.equal(JSON.parse(storage.gw_swap_op_last).stage, 'failed');
  });
});

describe('D05 EVM receipt monitors', () => {
  it('classifyEvmReceipt success/fail/pending', () => {
    assert.equal(GromSwapCore.classifyEvmReceipt(null).outcome, 'pending');
    assert.equal(GromSwapCore.classifyEvmReceipt({ status: '0x1' }).outcome, 'completed');
    assert.equal(GromSwapCore.classifyEvmReceipt({ status: '0x0' }).outcome, 'failed');
  });

  it('resume evm_receipt starts gwEvmConfirmMonitor not toast-only', () => {
    let started = null;
    const op = {
      id: 'op_evm',
      stage: 'submitted',
      namespace: 'evm',
      hash: '0xabc',
      chainId: 42161,
      startedAt: Date.now(),
    };
    const c = makeCtx(['gwResumeSwapOpFromStorage'], {
      localStorage: {
        getItem: (k) => (k === 'gw_swap_op' ? JSON.stringify(op) : null),
        setItem() {},
        removeItem() {},
      },
      gwEvmConfirmMonitor: (p) => {
        started = p;
      },
      gwToast() {},
      gwDsSubmit() {},
      document: {
        getElementById: () => ({ classList: { add() {}, remove() {} } }),
      },
    });
    c.gwResumeSwapOpFromStorage();
    assert.equal(started?.hash, '0xabc');
    assert.equal(started?.chainId, 42161);
  });

  it('gwEvmConfirmMonitor deferred success then terminal', async () => {
    let resolveRpc;
    const body = new Promise((r) => {
      resolveRpc = r;
    });
    const storage = {};
    const c = makeCtx(
      ['gwSwapOpGet', 'gwSwapOpUpdate', 'gwSwapOpClear', 'gwMonitorTerminal', 'gwEvmConfirmMonitor'],
      {
        _storage: storage,
        window: {
          __gwSwapOp: {
            id: 'OP',
            stage: 'submitted',
            hash: '0xdead',
            chainId: 42161,
            namespace: 'evm',
          },
        },
        gwRpcTry: async () => body,
        gwToast() {},
        gwDsResetSubmitState() {},
        gwDsSubmit() {},
        document: {
          getElementById: () => ({ classList: { add() {}, remove() {} } }),
        },
      },
    );
    storage.gw_swap_op = JSON.stringify(c.window.__gwSwapOp);
    c.gwDsSubmit._busy = true;
    c.gwEvmConfirmMonitor({ hash: '0xdead', chainId: 42161, opId: 'OP' });
    await flush(20);
    assert.equal(c.window.__gwSwapOp?.stage, 'submitted');
    resolveRpc({ status: '0x1', transactionHash: '0xdead' });
    await flush(80);
    assert.equal(c.window.__gwSwapOp, null);
    assert.equal(JSON.parse(storage.gw_swap_op_last).stage, 'completed');
  });

  it('gwEvmConfirmMonitor revert → failed', async () => {
    const storage = {};
    const c = makeCtx(
      ['gwSwapOpGet', 'gwSwapOpClear', 'gwMonitorTerminal', 'gwEvmConfirmMonitor'],
      {
        _storage: storage,
        window: { __gwSwapOp: { id: 'OP', stage: 'submitted', hash: '0xbad', chainId: 1 } },
        gwRpcTry: async () => ({ status: '0x0' }),
        gwToast() {},
        gwDsResetSubmitState() {},
        gwDsSubmit() {},
        document: {
          getElementById: () => ({ classList: { add() {}, remove() {} } }),
        },
      },
    );
    await c.gwEvmConfirmMonitor({ hash: '0xbad', chainId: 1, opId: 'OP' });
    await flush(40);
    assert.equal(JSON.parse(storage.gw_swap_op_last).stage, 'failed');
  });

});

describe('LI.FI status request recovery', () => {
  function monitor(fetch) {
    const timers = new Map();
    const op = { ...swapOp(), bridge: 'across', stage: 'bridging' };
    const c = makeCtx(['gwSwapOpGet', 'gwSwapOpUpdate', 'gwSwapOpClear', 'gwNormalizeLifiBridgeStatus', 'gwLifiBridgeMonitor'], {
      window: { __gwSwapOp: op },
      GW_LIFI_ENDPOINT: 'https://li.quest/v1', AbortController,
      setTimeout(fn, ms) { const timer = { fn, ms }; timers.set(timer, timer); return timer; },
      clearTimeout(timer) { timers.delete(timer); },
      fetch,
      gwToast() {}, gwDsSubmit() {}, gwUxOpChanged() {}, gwDsResetSubmitState() {},
    });
    c._storage.gw_swap_op = JSON.stringify(op);
    c.gwLifiBridgeMonitor({ txHash: op.hash, fromChainId: 1, toChainId: 42161, opId: op.id });
    return { c, op, timers };
  }

  it('aborts a hung request, preserves the send lock, then resolves on a successful retry', async () => {
    let attempts = 0;
    let aborted = false;
    const { c, op, timers } = monitor(async (_url, { signal }) => {
      attempts++;
      if (attempts === 1) return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); }, { once: true });
      });
      return { ok: true, json: async () => ({ status: 'DONE', substatus: 'COMPLETED', receiving: { txHash: destinationHash } }) };
    });
    const deadline = [...timers.values()].find(t => t.ms === 10000);
    assert.ok(deadline, 'request has a deadline');
    deadline.fn();
    await flush(0);
    assert.equal(aborted, true);
    assert.equal(c.window.__gwSwapOp.id, op.id);
    assert.equal(JSON.parse(c._storage.gw_swap_op).stage, 'bridging');
    assert.equal(c._storage.gw_swap_op_last, undefined);
    const retry = [...timers.values()].find(t => t.ms === 30000);
    assert.ok(retry, 'a request timeout schedules another status check');
    await retry.fn();
    assert.equal(attempts, 2);
    assert.equal(c.window.__gwSwapOp, null);
    assert.equal(JSON.parse(c._storage.gw_swap_op_last).stage, 'completed');
    assert.equal([...timers.values()].some(t => t.ms === 10000), false);
  });

  it('does not accept a success-shaped HTTP error body as delivery', async () => {
    let bodyRead = false;
    const { c, op, timers } = monitor(async () => ({
      ok: false, status: 502,
      json: async () => { bodyRead = true; return { status: 'DONE', substatus: 'COMPLETED' }; },
    }));
    await flush(0);
    assert.equal(bodyRead, false);
    assert.equal(c.window.__gwSwapOp.id, op.id);
    assert.ok([...timers.values()].some(t => t.ms === 30000));
  });

  it('a delayed response cannot complete a replacement operation', async () => {
    let finish;
    const { c, timers } = monitor(() => new Promise(resolve => { finish = resolve; }));
    c.window.__gwSwapOp = { ...swapOp(), id: 'replacement', hash: destinationHash };
    finish({ ok: true, json: async () => ({ status: 'DONE', substatus: 'COMPLETED' }) });
    await flush(0);
    assert.equal(c.window.__gwSwapOp.id, 'replacement');
    assert.equal(c._storage.gw_swap_op_last, undefined);
    assert.equal(timers.size, 0, 'obsolete monitor neither keeps a deadline nor schedules another poll');
  });
});

describe('Squid cross-chain status monitor', () => {
  it('only reports full delivery as completed and clears the stale operation', async () => {
    let requestUrl = '';
    let requestHeaders = null;
    const storage = {};
    const c = makeCtx(
      ['gwSwapOpGet', 'gwSwapOpUpdate', 'gwSwapOpClear', 'gwNormalizeSquidBridgeStatus', 'gwSquidBridgeMonitor'],
      {
        _storage: storage,
        window: {
          __gwSwapOp: { id: 'OP', stage: 'unknown', hash: '0xhash', namespace: 'evm', bridge: 'squid', fromChainId: 1, toChainId: 42161 },
        },
        gwSquidIntegratorId: () => 'grom-test-id',
        fetch: async (url, opts) => {
          requestUrl = String(url); requestHeaders = opts.headers;
          return { ok: true, json: async () => ({ squidTransactionStatus: 'SUCCESS', toChain: { transactionId: '0xdest' } }) };
        },
        gwToast() {}, gwDsSubmit() {}, gwUxOpChanged() {},
        gwDsResetSubmitState() {},
        document: { getElementById: () => ({ classList: { add() {}, remove() {} } }) },
      },
    );
    storage.gw_swap_op = JSON.stringify(c.window.__gwSwapOp);
    c.gwSquidBridgeMonitor({ txHash: '0xhash', fromChainId: 1, toChainId: 42161, quoteId: 'q-1', opId: 'OP' });
    await flush(80);
    assert.match(requestUrl, /v2\.api\.squidrouter\.com\/v2\/status/);
    assert.match(requestUrl, /transactionId=0xhash/);
    assert.match(requestUrl, /fromChainId=1/);
    assert.match(requestUrl, /toChainId=42161/);
    assert.match(requestUrl, /quoteId=q-1/);
    assert.equal(requestHeaders['x-integrator-id'], 'grom-test-id');
    assert.equal(c.window.__gwSwapOp, null);
    assert.equal(JSON.parse(storage.gw_swap_op_last).stage, 'completed');
  });

  it('keeps ongoing, needs-gas and not-found routes unresolved', () => {
    const c = makeCtx(['gwNormalizeSquidBridgeStatus']);
    assert.equal(c.gwNormalizeSquidBridgeStatus({ squidTransactionStatus: 'ONGOING' }).outcome, 'bridging');
    assert.equal(c.gwNormalizeSquidBridgeStatus({ squidTransactionStatus: 'NEEDS_GAS' }).outcome, 'bridging');
    assert.equal(c.gwNormalizeSquidBridgeStatus({ squidTransactionStatus: 'NOT_FOUND' }).outcome, 'unknown');
    assert.equal(c.gwNormalizeSquidBridgeStatus({ squidTransactionStatus: 'PARTIAL_SUCCESS' }).outcome, 'partial');
  });

  for (const partial of [false, true]) {
    it(`recovers a blocked Squid status request only after the destination receipt proves ${partial ? 'partial' : 'completed'}`, async () => {
      const op = swapOp();
      const storage = { gw_tx_log_v1: JSON.stringify([{ hash: sourceHash, status: 'bridging' }]) };
      const requests = [];
      let receiptReads = 0;
      const c = makeCtx(
        ['gwSwapOpGet', 'gwSwapOpUpdate', 'gwSwapOpClear', 'gwTxLogUpdateStatus', 'gwNormalizeSquidBridgeStatus', 'gwNormalizeAxelarGmpStatus', 'gwClassifySquidDestinationReceipt', 'gwSquidBridgeMonitor'],
        {
          _storage: storage, window: { __gwSwapOp: op },
          fetch: async (url) => {
            requests.push(String(url));
            if (String(url).startsWith('https://v2.api.squidrouter.com/')) throw new Error('blocked by client');
            return { ok: true, json: async () => normalizeAxelarGmpStatus(axelarPayload(), sourceHash) };
          },
          gwRpcTry: async (chain, method, params) => {
            receiptReads++;
            assert.equal(chain, 42161); assert.equal(method, 'eth_getTransactionReceipt'); assert.equal(params[0], destinationHash);
            return squidReceipt(partial);
          },
          gwToast() {}, gwDsSubmit() {}, gwUxOpChanged() {}, gwDsResetSubmitState() {},
          document: { getElementById: () => ({ classList: { add() {}, remove() {} } }) },
        },
      );
      storage.gw_swap_op = JSON.stringify(op);
      c.gwSquidBridgeMonitor({ txHash: op.hash, bridge: 'squid', opId: op.id });
      await flush(40);
      assert.equal(requests.length, 2); assert.equal(receiptReads, 1);
      assert.match(requests[1], /^\/api\/market\/bridge\/axelar\/status\?txHash=/);
      assert.equal(c.window.__gwSwapOp, null);
      assert.equal(JSON.parse(storage.gw_swap_op_last).stage, partial ? 'partial' : 'completed');
      assert.equal(JSON.parse(storage.gw_tx_log_v1)[0].status, partial ? 'partial' : 'completed');
      assert.equal(JSON.parse(storage.gw_swap_op_last).destTxHash, destinationHash);
    });
  }

  it('honors backend rejection and binds source hash, account and both chains before receipt lookup', () => {
    const c = makeCtx(['gwNormalizeAxelarGmpStatus']);
    const evidence = normalizeAxelarGmpStatus(axelarPayload(), sourceHash);
    const op = swapOp();
    assert.equal(c.gwNormalizeAxelarGmpStatus(evidence, op).outcome, 'destination_check');
    for (const patch of [{ found: false }, { outcome: 'unknown' }, { bridgeExecuted: false }, { sourceTxHash: destinationHash },
      { sourceAccount: `0x${'2'.repeat(40)}` }, { sourceChainId: 8453 }, { destinationChainId: 1 }, { destinationTxHash: null }]) {
      assert.equal(c.gwNormalizeAxelarGmpStatus({ ...evidence, ...patch }, op).outcome, 'unknown');
    }
    assert.equal(c.gwNormalizeAxelarGmpStatus({ status: 'executed', simplifiedStatus: 'received' }, op).success, false);
  });

  it('requires a successful receipt and the exact Squid event emitter and payload', () => {
    const c = makeCtx(['gwClassifySquidDestinationReceipt']);
    const evidence = normalizeAxelarGmpStatus(axelarPayload(), sourceHash);
    assert.equal(c.gwClassifySquidDestinationReceipt(squidReceipt(), evidence).outcome, 'completed');
    for (const mutate of [
      r => { r.status = '0x0'; }, r => { r.transactionHash = sourceHash; }, r => { r.to = `0x${'2'.repeat(40)}`; },
      r => { r.logs[0].address = `0x${'2'.repeat(40)}`; }, r => { delete r.logs[0].address; },
      r => { r.logs[0].topics[1] = sourceHash; }, r => { r.logs[0].removed = true; },
      r => { r.logs = []; }, r => { r.logs.push(...squidReceipt(true).logs); },
    ]) {
      const receipt = squidReceipt(); mutate(receipt);
      assert.equal(c.gwClassifySquidDestinationReceipt(receipt, evidence).outcome, 'unknown');
    }
  });

  it('keeps unresolved destination receipts locked and ignores receipts for replaced operations', async () => {
    let resolveReceipt;
    const op = swapOp();
    const c = makeCtx(['gwSwapOpGet', 'gwSwapOpUpdate', 'gwSwapOpClear', 'gwNormalizeSquidBridgeStatus', 'gwNormalizeAxelarGmpStatus', 'gwClassifySquidDestinationReceipt', 'gwSquidBridgeMonitor'], {
      window: { __gwSwapOp: op }, setTimeout() {},
      fetch: async (url) => {
        if (String(url).startsWith('https:')) throw new Error('blocked');
        return { ok: true, json: async () => normalizeAxelarGmpStatus(axelarPayload(), sourceHash) };
      },
      gwRpcTry: () => new Promise(resolve => { resolveReceipt = resolve; }),
      gwToast() {}, gwUxOpChanged() {},
    });
    c.gwSquidBridgeMonitor({ txHash: sourceHash, opId: op.id });
    await flush(20);
    assert.equal(c.window.__gwSwapOp.stage, 'unknown');
    const next = { ...op, id: 'NEW-OP', hash: destinationHash };
    c.window.__gwSwapOp = next;
    resolveReceipt(squidReceipt());
    await flush(20);
    assert.equal(c.window.__gwSwapOp.id, 'NEW-OP');
    assert.equal(c.window.__gwSwapOp.stage, 'unknown');
  });

  it('updates the existing wallet-history row when the bridge reaches a terminal status', () => {
    const storage = {
      gw_tx_log_v1: JSON.stringify([{ hash: '0xAbC', status: 'bridging', fromSym: 'ETH', toSym: 'USDC' }]),
    };
    let historyRefreshes = 0;
    const c = makeCtx(['gwSwapOpGet', 'gwSwapOpClear', 'gwTxLogUpdateStatus'], {
      _storage: storage,
      window: {
        __gwSwapOp: { id: 'OP', stage: 'bridging', hash: '0xabc', destTxHash: '0xdest' },
        hydrateHistoryPage: () => { historyRefreshes++; },
      },
      gwUxOpChanged() {},
      document: { getElementById: () => ({ remove() {} }) },
    });

    c.gwSwapOpClear('completed');

    const rows = JSON.parse(storage.gw_tx_log_v1);
    assert.equal(rows[0].status, 'completed');
    assert.equal(rows[0].destTxHash, '0xdest');
    assert.equal(historyRefreshes, 1);
    assert.equal(c.gwTxLogUpdateStatus({ hash: '0xabc', status: 'failed' }), 0);
    assert.equal(JSON.parse(storage.gw_tx_log_v1)[0].status, 'completed');
  });
});

describe('C01/C03/C05 still green (smoke)', () => {
  it('mandatory refresh + amount + chip resolve unchanged', () => {
    assert.equal(GromSwapCore.requiresMandatoryPreSignRefresh('LiFi'), true);
    assert.equal(GromSwapCore.canonicalAmountString('1.000000000000000001'), '1.000000000000000001');
    assert.equal(
      GromSwapCore.resolveSwapUiNamespace({
        activeChip: { cid: 1 },
        pickedFrom: { nonevm: 'sol' },
      }).namespace,
      'evm',
    );
  });
});

describe('EVM swap handoff to receipt monitor', () => {
  it('returns the signed hash without blocking on the receipt when monitor mode is enabled', async () => {
    let waitReceiptCalls = 0;
    const c = makeCtx(['gwOnChainSwapExecMeta'], {
      GW_OC_SWAP: {
        42161: { native: 'ETH', wrapped: '0xwrapped', tokens: {}, decimals: { ETH: 18 } },
      },
      gwEnsureChain: async () => {},
      gwResolveEvmToken: () => ({ address: '0xwrapped', decimals: 18, isNative: true }),
      gwDsCanonicalAmtStr: (v) => String(v),
      gwDsTokenBalanceOnChain: async () => 10,
      gwAmtToBaseUnits: () => 1n,
      gwAggBuildTxIfNeeded: async () => {},
      gwSimulateSwapTx: async () => ({ ok: true }),
      gwOrdValidateExecQuote() {},
      gwIsFeeVerified: () => true,
      gwWakeWalletForSigning() {},
      gwEnsureLiveSigningProvider: async (provider) => provider,
      gwAssertNativeTxValue() {},
      gwProviderSendTx: async () => '0x' + 'a'.repeat(64),
      gwWaitReceipt: async () => { waitReceiptCalls += 1; },
      gwToast() {},
      window: { GromSwapCore },
    });
    const result = await c.gwOnChainSwapExecMeta({
      chainId: 42161,
      fromSym: 'ETH',
      toSym: 'USDC',
      amtNum: '0.001',
      provider: { request: async () => [] },
      account: '0x' + '1'.repeat(40),
      deferReceipt: true,
      quote: {
        aggregator: 'Uniswap',
        transactionRequest: { to: '0x' + '2'.repeat(40), data: '0x1234', value: '0x0' },
        toAmount: 1n,
        outDecimals: 6,
        _fromChainId: 42161,
        _toChainId: 42161,
        _crossChain: false,
      },
    });
    assert.equal(result.status, 'submitted');
    assert.equal(result.confirmed, false);
    assert.equal(result.hash, '0x' + 'a'.repeat(64));
    assert.equal(result.fromChainId, 42161);
    assert.equal(waitReceiptCalls, 0);
  });
});

describe('cross-chain swap handoff', () => {
  it('returns the EVM source hash immediately with the bridge destination attached', async () => {
    let waitReceiptCalls = 0;
    let lifiQuoteCalls = 0;
    let sentData = '';
    const c = makeCtx(['gwOnChainSwapExecLifi'], {
      GW_OC_SWAP: {
        42161: { native: 'ETH', wrapped: '0xwrapped', tokens: {}, decimals: { ETH: 18 } },
      },
      gwEnsureChain: async () => {},
      gwResolveEvmToken: () => ({ address: '0xwrapped', decimals: 18, isNative: true }),
      gwAmtToBaseUnits: () => 1n,
      gwLifiQuote: async (args) => {
        lifiQuoteCalls += 1;
        assert.equal(args.chainId, 42161);
        assert.equal(args.toChainId, 1151111081099710);
        return {
          transactionRequest: { to: '0x' + '3'.repeat(40), data: '0xfresh', value: '0x0' },
          estimate: { toAmount: '1' },
          _fromChainId: 42161,
          _toChainId: 1151111081099710,
          _crossChain: true,
          tool: 'Mayan',
        };
      },
      gwWakeWalletForSigning() {},
      gwAssertNativeTxValue() {},
      gwToast() {},
      gwWaitReceipt: async () => { waitReceiptCalls += 1; },
      window: {
        GromSwapCore,
        gwProviderSendTx: async (_provider, tx) => {
          sentData = tx.data;
          return '0x' + 'b'.repeat(64);
        },
      },
    });
    const result = await c.gwOnChainSwapExecLifi({
      chainId: 42161,
      fromSym: 'ETH',
      toSym: 'SOL',
      amtNum: '0.001',
      provider: { request: async () => [] },
      account: '0x' + '1'.repeat(40),
      deferReceipt: true,
      quote: {
        transactionRequest: { to: '0x' + '2'.repeat(40), data: '0x1234', value: '0x0' },
        _fromChainId: 42161,
        _toChainId: 1151111081099710,
        _crossChain: true,
        tool: 'Mayan',
      },
    });
    assert.equal(result.status, 'bridging');
    assert.equal(result.fromChainId, 42161);
    assert.equal(result.toChainId, 1151111081099710);
    assert.equal(waitReceiptCalls, 0);
    assert.equal(lifiQuoteCalls, 1);
    assert.equal(sentData, '0xfresh', 'must send refreshed calldata instead of the preview quote');
  });

  it('refuses a stale fallback quote before wallet send', async () => {
    let sendCalls = 0;
    const c = makeCtx(['gwOnChainSwapExecLifi'], {
      GW_OC_SWAP: {
        42161: { native: 'ETH', wrapped: '0xwrapped', tokens: {}, decimals: { ETH: 18 } },
      },
      gwEnsureChain: async () => {},
      gwResolveEvmToken: () => ({ address: '0xwrapped', decimals: 18, isNative: true }),
      gwAmtToBaseUnits: () => 1n,
      gwLifiQuote: async () => ({
        transactionRequest: { to: '0x' + '3'.repeat(40), data: '0xstale', value: '0x0' },
        estimate: { toAmount: '1' },
        _fromChainId: 42161,
        _toChainId: 1151111081099710,
        _crossChain: true,
        _gromStale: true,
      }),
      gwWakeWalletForSigning() {},
      gwToast() {},
      window: {
        GromSwapCore,
        gwProviderSendTx: async () => { sendCalls += 1; return '0x' + 'c'.repeat(64); },
      },
    });
    await assert.rejects(
      c.gwOnChainSwapExecLifi({
        chainId: 42161,
        fromSym: 'ETH',
        toSym: 'SOL',
        amtNum: '0.001',
        provider: { request: async () => [] },
        account: '0x' + '1'.repeat(40),
        deferReceipt: true,
        quote: {
          transactionRequest: { to: '0x' + '2'.repeat(40), data: '0xpreview', value: '0x0' },
          _fromChainId: 42161,
          _toChainId: 1151111081099710,
          _crossChain: true,
        },
      }),
      /quote is stale/i,
    );
    assert.equal(sendCalls, 0);
  });

  it('keeps the source Solana signature and both chains for LI.FI status polling', async () => {
    const c = makeCtx(['gwLifiExecSolana'], {
      gwSolGetInjected: () => ({}),
      gwSolSignAndSendBase64: async () => 'solana-signature',
      gwToast() {},
      window: { GromSwapCore },
    });
    const result = await c.gwLifiExecSolana({
      fromSym: 'SOL',
      toSym: 'USDC',
      amtNum: '0.1',
      quote: {
        transactionRequest: { data: 'YWJj' },
        _fromChainId: 1151111081099710,
        _toChainId: 42161,
        _crossChain: true,
        tool: 'Mayan',
      },
    });
    assert.equal(result.status, 'bridging');
    assert.equal(result.namespace, 'solana');
    assert.equal(result.signature, 'solana-signature');
    assert.equal(result.fromChainId, 1151111081099710);
    assert.equal(result.toChainId, 42161);
  });

  it('keeps the source Tron tx id and route metadata for LI.FI status polling', async () => {
    const c = makeCtx(['gwLifiExecTron'], {
      gwTronWithSigningWeb: async () => ({
        tw: {
          trx: {
            sign: async (tx) => ({ ...tx, txID: 'tron-tx-id' }),
            sendRawTransaction: async () => ({ txid: 'tron-tx-id' }),
          },
        },
        user: 'TSourceAddress',
        restore() {},
      }),
      gwTronSaveAddr() {},
      gwToast() {},
      window: { GromSwapCore },
    });
    const result = await c.gwLifiExecTron({
      fromSym: 'USDT',
      toSym: 'ETH',
      amtNum: '10',
      quote: {
        transactionRequest: { customData: { tronTransaction: { txID: 'tron-tx-id' } } },
        _fromChainId: 728126428,
        _toChainId: 42161,
        _crossChain: true,
        tool: 'Stargate',
      },
    });
    assert.equal(result.status, 'bridging');
    assert.equal(result.namespace, 'tron');
    assert.equal(result.hash, 'tron-tx-id');
    assert.equal(result.fromChainId, 728126428);
    assert.equal(result.toChainId, 42161);
  });

  it('does not classify slow preflight as a wallet timeout', () => {
    const startedAt = 1_000_000;
    assert.equal(GromSwapCore.swapCtaModel({ connected: true, amount: 1, pairValid: true, busy: true, stage: 'preparing' }).key, 'preparing');
    assert.equal(GromSwapCore.swapWalletWatchdogState({ stage: 'preparing', startedAt }, startedAt + 120_000), 'preparing');
    assert.equal(GromSwapCore.swapWalletWatchdogState({ stage: 'awaiting_signature', walletRequestAt: startedAt }, startedAt + 19_999), 'wallet_pending');
    assert.equal(GromSwapCore.swapWalletWatchdogState({ stage: 'awaiting_signature', walletRequestAt: startedAt }, startedAt + 20_000), 'unknown');
    assert.equal(GromSwapCore.swapWalletWatchdogState({ stage: 'submitted', walletRequestAt: startedAt, hash: '0xhash' }, startedAt + 120_000), 'settled');
  });

  it('separates approval confirmation from an unanswered wallet prompt', () => {
    const startedAt = 1_000_000;
    const approvalPending = {
      stage: 'approval_pending', requestDispatched: true, walletRequestPending: false,
      walletRequestSettledAt: startedAt + 1, approvalPending: true, approvalHash: '0xapproval',
      walletRequestAt: startedAt,
    };
    assert.equal(GromSwapCore.swapWalletActionPending(approvalPending), true);
    assert.equal(GromSwapCore.swapWalletWatchdogState(approvalPending, startedAt + 120_000), 'settled');
    const approvalConfirmed = { ...approvalPending, approvalPending: false, approvalConfirmedAt: startedAt + 2 };
    assert.equal(GromSwapCore.swapWalletActionPending(approvalConfirmed), false);
    assert.equal(GromSwapCore.swapWalletWatchdogState(approvalConfirmed, startedAt + 120_000), 'settled');
    assert.equal(GromSwapCore.swapWalletActionPending({ requestDispatched: true }), true, 'legacy records stay conservative');
  });

  it('releases approval-pending state only after its receipt is confirmed', async () => {
    const op = { id: 'op-approval', stage: 'preparing', requestDispatched: true, walletRequestPending: false };
    const c = makeCtx(['gwSwapOpGet', 'gwSwapOpUpdate', 'gwWaitSwapApproval'], {
      window: { __gwSwapOp: op }, gwUxOpChanged() {},
      gwWaitReceipt: async () => ({ status: '0x1', blockNumber: '0x2a' }),
    });
    await c.gwWaitSwapApproval({}, '0xapproval', 42161);
    assert.equal(c.window.__gwSwapOp.approvalHash, '0xapproval');
    assert.equal(c.window.__gwSwapOp.approvalPending, false);
    assert.equal(c.window.__gwSwapOp.approvalReceiptBlock, '0x2a');
    assert.equal(GromSwapCore.swapWalletActionPending(c.window.__gwSwapOp), false);

    const unresolved = makeCtx(['gwSwapOpGet', 'gwSwapOpUpdate', 'gwWaitSwapApproval'], {
      window: { __gwSwapOp: { id: 'op-timeout', stage: 'preparing' } }, gwUxOpChanged() {},
      gwWaitReceipt: async () => { throw new Error('Transaction timed out — check your wallet'); },
    });
    await assert.rejects(() => unresolved.gwWaitSwapApproval({}, '0xpending', 42161), /timed out/);
    assert.equal(unresolved.window.__gwSwapOp.approvalPending, true);
    assert.equal(GromSwapCore.swapWalletActionPending(unresolved.window.__gwSwapOp), true);
  });

  it('unlocks a settled approval-only operation, but keeps an unconfirmed approval locked', () => {
    const settled = makeCtx(['gwSwapOpGet', 'gwSwapWalletActionPending', 'gwSwapOpIsActive'], {
      window: { __gwSwapOp: { stage: 'preparing', requestDispatched: true, walletRequestPending: false, walletRequestSettledAt: 10, approvalHash: '0xapproved', approvalPending: false } },
    });
    assert.equal(settled.gwSwapOpIsActive(), false);

    const pending = makeCtx(['gwSwapOpGet', 'gwSwapWalletActionPending', 'gwSwapOpIsActive'], {
      window: { __gwSwapOp: { stage: 'approval_pending', requestDispatched: true, walletRequestPending: false, walletRequestSettledAt: 10, approvalHash: '0xpending', approvalPending: true } },
    });
    assert.equal(pending.gwSwapOpIsActive(), true);
  });

  it('marks the wallet request at provider dispatch, after swap preparation', async () => {
    const op = { id: 'op-test', stage: 'preparing', from: 'USDC', to: 'ETH', amt: '1' };
    let walletPromptMarked = false;
    const c = makeCtx(['gwSwapOpGet', 'gwSwapOpUpdate', 'gwMarkSwapWalletRequestDispatched', 'gwMarkSwapWalletRequestSettled', 'gwProviderRequestWithWake'], {
      window: { __gwSwapOp: op },
      gwUxOpChanged() {},
      gromSwapMarkAwaitingWallet() { walletPromptMarked = true; },
      gwDsSubmit: { _armWalletWatchdog() {} },
      gwIsRemoteWcSigner: () => false,
      setTimeout: () => 1,
    });
    assert.equal(c.window.__gwSwapOp.stage, 'preparing');
    assert.equal(walletPromptMarked, false);
    let stageSeenByWallet;
    await c.gwProviderRequestWithWake({
      request: async (args) => {
        stageSeenByWallet = c.window.__gwSwapOp.stage;
        assert.equal(args.method, 'eth_sendTransaction');
        return '0x' + 'a'.repeat(64);
      },
    }, { method: 'eth_sendTransaction', params: [{}] });
    assert.equal(stageSeenByWallet, 'preparing');
    assert.equal(c.window.__gwSwapOp.requestDispatched, true);
    assert.ok(c.window.__gwSwapOp.walletRequestAt > 0);
    assert.equal(c.window.__gwSwapOp.walletRequestPending, false);
    assert.equal(c.window.__gwSwapOp.hash, '0x' + 'a'.repeat(64));
    assert.equal(walletPromptMarked, true);
  });

  it('clears a rejected request but keeps an ambiguous send unresolved', async () => {
    const make = () => {
      const op = { id: 'op-test', stage: 'preparing', from: 'USDC', to: 'ETH', amt: '1' };
      return makeCtx(['gwSwapOpGet', 'gwSwapOpUpdate', 'gwMarkSwapWalletRequestDispatched', 'gwMarkSwapWalletRequestSettled', 'gwProviderRequestWithWake'], {
        window: { __gwSwapOp: op }, gwUxOpChanged() {}, gromSwapMarkAwaitingWallet() {},
        gwDsSubmit: { _armWalletWatchdog() {} }, gwIsRemoteWcSigner: () => false, setTimeout: () => 1,
      });
    };
    const rejected = make();
    await assert.rejects(() => rejected.gwProviderRequestWithWake({ request: async () => { const e = new Error('User rejected the request'); e.code = 4001; throw e; } }, { method: 'eth_sendTransaction' }));
    assert.equal(rejected.window.__gwSwapOp.walletRequestPending, false);
    assert.equal(GromSwapCore.swapWalletActionPending(rejected.window.__gwSwapOp), false);

    const ambiguous = make();
    await assert.rejects(() => ambiguous.gwProviderRequestWithWake({ request: async () => { throw new Error('Network disconnected after request'); } }, { method: 'eth_sendTransaction' }));
    assert.equal(ambiguous.window.__gwSwapOp.walletRequestPending, false);
    assert.equal(ambiguous.window.__gwSwapOp.walletResultUnknown, true);
    assert.equal(GromSwapCore.swapWalletActionPending(ambiguous.window.__gwSwapOp), true);
  });
});
