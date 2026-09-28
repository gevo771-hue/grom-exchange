import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

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
      ['gwSwapOpGet', 'gwSwapOpBegin', 'gwSwapOpUpdate', 'gwSwapOpClear', 'gwSwapOpIsActive', 'gwDsSubmit'],
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
          // Lock is kept only when a tx artifact exists (hash/sig/boc).
          // Model ambiguous post-broadcast: candidate sig present, send still unknown.
          c.gwSwapOpUpdate({
            hash: 'AmbiguousSig111',
            signature: 'AmbiguousSig111',
            namespace: 'solana',
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
    assert.equal(c.gwDsSubmit._busy, true);
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
