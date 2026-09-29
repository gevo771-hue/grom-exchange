/**
 * GROM Instant Swap — pure product helpers (R01–R11).
 * Loaded before grom-wallet.js; also importable under Node for regression tests.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GromSwapCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** JSON-RPC eth_getBlockByNumber txs use `input`; wallet params use `data` (R01). */
  function normalizeRpcTxCalldata(tx) {
    if (!tx || typeof tx !== 'object') return '';
    return String(tx.input != null && tx.input !== '' ? tx.input : (tx.data || '')).toLowerCase();
  }

  function normalizeRpcTxValue(tx) {
    if (!tx || typeof tx !== 'object') return '0x0';
    return String(tx.value != null ? tx.value : '0x0').toLowerCase();
  }

  /** Canonical decimal amount string — no Number() (R10). */
  function canonicalAmountString(raw) {
    if (raw == null) return '';
    let s = String(raw).trim().replace(/\s+/g, '').replace(/^\u2212/, '-');
    if (!s || s.startsWith('-')) return '';
    if (/[eE]/.test(s)) return ''; // reject scientific — force explicit decimals
    if (s.includes(',') && s.includes('.')) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    }
    if (!/^\d+(\.\d+)?$/.test(s)) return '';
    // strip leading zeros but keep "0.…"
    const [w, f] = s.split('.');
    const whole = w.replace(/^0+(?=\d)/, '') || '0';
    if (f == null) return whole;
    const frac = f.replace(/0+$/, '');
    return frac ? `${whole}.${frac}` : whole;
  }

  function isWalletUserRejection(err) {
    const code = err && (err.code ?? err?.error?.code);
    if (code === 4001 || code === '4001' || code === 'ACTION_REJECTED') return true;
    const msg = String(err?.message || err?.error?.message || err || '');
    return /user rejected|user denied|rejected the request|denied transaction|cancelled by user|canceled by user/i.test(msg);
  }

  /** Whether a persisted swap op should restore the lock after reload (R02). */
  function shouldRestoreSwapOp(op) {
    if (!op || typeof op !== 'object') return false;
    const stage = String(op.stage || '');
    if (/completed|failed|cancelled|refunded/i.test(stage)) return false;
    // Restore even without hash: unknown / awaiting_signature / submitted / bridging / …
    return /awaiting_signature|unknown|submitted|source_confirmed|bridging|pending|awaiting_result/i.test(stage)
      || !stage;
  }

  /** Bridge monitor may only mutate the op it was started for (R03). */
  function bridgeMonitorOwnsOp(op, { opId, txHash } = {}) {
    if (!op) return false;
    if (opId && op.id && String(op.id) !== String(opId)) return false;
    if (txHash && op.hash && String(op.hash).toLowerCase() !== String(txHash).toLowerCase()) return false;
    return true;
  }

  /** Settings percent → fraction; adapters convert at the edge (R04). */
  function slippageToFraction(raw, fallback = 0.005) {
    if (raw == null || raw === '') return fallback;
    let s = String(raw).trim().replace(/%/g, '').replace(/\s+/g, '');
    if (!s) return fallback;
    if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
    else s = s.replace(/,/g, '');
    const n = Number(s);
    if (!Number.isFinite(n) || n <= 0 || n > 50) return fallback;
    let frac = n / 100;
    if (frac > 0.5) frac = 0.5;
    if (frac < 0.0001) frac = 0.0001;
    return frac;
  }

  function slippageToBps(frac) {
    const f = Number(frac);
    if (!Number.isFinite(f) || f <= 0) return 50;
    return Math.max(1, Math.min(5000, Math.round(f * 10000)));
  }

  function slippageToOdosPercent(frac) {
    // Odos slippageLimitPercent is percent units (0.5 = 0.5%)
    const f = Number(frac);
    if (!Number.isFinite(f) || f <= 0) return 0.5;
    return Math.max(0.01, Math.min(50, f * 100));
  }

  /** Squid uses percent number (1 = 1%). */
  function slippageToSquidPercent(frac) {
    return slippageToOdosPercent(frac);
  }

  function pickExecBridgeMeta(quote, aggBag) {
    const q = quote || {};
    const top = aggBag && !Array.isArray(aggBag.quotes) ? aggBag : null;
    const tool = q.tool || q.bridge || q.aggregator || top?.tool || top?.bridge || '';
    return {
      bridge: String(tool || '').replace(/^LiFi$/i, '') || String(q.toolDetails?.key || q.tool || 'across'),
      fromChainId: Number(q._fromChainId || q._gromFromChainId || top?.fromChainId || 0) || null,
      toChainId: Number(q._toChainId || q._gromToChainId || top?.toChainId || 0) || null,
      crossChain: !!(q._crossChain || (q._toChainId && q._fromChainId && Number(q._toChainId) !== Number(q._fromChainId))),
    };
  }

  /** Normalize executor return into status machine fields (R09). */
  function normalizeExecResult(result, { namespace = 'evm', crossChain = false } = {}) {
    if (result && typeof result === 'object' && (result.hash || result.signature || result.boc)) {
      let status = result.status;
      if (!status) {
        if (crossChain) status = 'bridging';
        else if (result.confirmed) status = 'completed';
        else status = 'submitted';
      }
      return {
        hash: result.hash || result.signature || result.boc || '',
        status,
        namespace: result.namespace || namespace,
        confirmed: !!(result.confirmed || status === 'completed'),
      };
    }
    const hash = typeof result === 'string' ? result : '';
    if (crossChain) return { hash, status: 'bridging', namespace, confirmed: false };
    // Non-EVM string return is submission only — never auto-completed
    if (namespace !== 'evm') return { hash, status: 'submitted', namespace, confirmed: false };
    return { hash, status: 'submitted', namespace: 'evm', confirmed: false };
  }

  /**
   * Match outbound JSON-RPC block txs (R01). eth_getBlockByNumber uses `input`;
   * wallet eth_sendTransaction params use `data`.
   */
  function findMatchingOutboundTx(txs, { from, to, nonce, data, value } = {}) {
    const fromLc = String(from || '').toLowerCase();
    const toLc = String(to || '').toLowerCase();
    const dataLc = String(data || '').toLowerCase();
    const norm = (v) => {
      let s = String(v || '0x0').toLowerCase();
      if (!s.startsWith('0x')) s = '0x' + s;
      try { return '0x' + BigInt(s).toString(16); } catch (_) { return s; }
    };
    const expectVal = norm(value);
    if (!fromLc || !toLc || !(nonce >= 0) || !dataLc) return null;
    for (const tx of txs || []) {
      if (!tx || typeof tx === 'string') continue;
      if (String(tx.from || '').toLowerCase() !== fromLc) continue;
      const n = typeof tx.nonce === 'string' && tx.nonce.startsWith('0x')
        ? parseInt(tx.nonce, 16)
        : Number(tx.nonce);
      if (n !== Number(nonce)) continue;
      if (String(tx.to || '').toLowerCase() !== toLc) continue;
      if (normalizeRpcTxCalldata(tx) !== dataLc) continue;
      if (norm(tx.value) !== expectVal) continue;
      return tx.hash || null;
    }
    return null;
  }

  /** Aggregators whose calldata expires fast — must refresh before sign (C01/R06). */
  function requiresMandatoryPreSignRefresh(aggregator) {
    return /Kyber|Paraswap|Odos|LiFi/i.test(String(aggregator || ''));
  }

  /** Solana: only proven pre-broadcast format errors may try an alternate shape (C02). */
  function isSolanaFormatError(err) {
    const msg = String(err?.message || err?.error?.message || err || '');
    const name = String(err?.name || '');
    if (/user rejected|user denied|4001|ACTION_REJECTED/i.test(msg)) return false;
    if (/network|disconnect|timeout|timed out|broadcast|empty signature|blockhash|slot/i.test(msg)) {
      return false;
    }
    return /deserializ|invalid (transaction|arguments|param)|unexpected (type|token)|not a (versioned )?transaction|expected .+transaction|cannot read prop|is not a function|VersionedTransaction|legacy transaction/i.test(msg)
      || (name === 'TypeError' && /transaction|serialize|sign/i.test(msg));
  }

  function shouldRetrySolanaSignShape(err) {
    if (isWalletUserRejection(err)) return false;
    return isSolanaFormatError(err);
  }

  /**
   * Solana sign+send with C02 policy. Payload must already be resolved.
   * Returns signature string. Never retries after ambiguous network/broadcast.
   */
  async function solSignAndSendWithPolicy(provider, payload, deps = {}) {
    const isReject = deps.isReject || isWalletUserRejection;
    const mayRetryFn = deps.shouldRetry || shouldRetrySolanaSignShape;
    const asUnknown = (e, empty) => {
      const unk = new Error(
        empty
          ? 'Solana send returned empty signature — check Phantom Activity before retrying'
          : 'Solana send result unknown — check Phantom Activity before retrying',
      );
      unk.code = empty ? 'SOLANA_EMPTY_SIGNATURE' : 'SOLANA_SEND_UNKNOWN';
      unk.cause = e;
      return unk;
    };
    try {
      const res = await provider.signAndSendTransaction(payload);
      const sig = res && (res.signature || res);
      if (sig) return sig;
      throw asUnknown(new Error('empty signature'), true);
    } catch (e) {
      if (isReject(e)) throw e;
      if (e && (e.code === 'SOLANA_SEND_UNKNOWN' || e.code === 'SOLANA_EMPTY_SIGNATURE')) throw e;
      if (!mayRetryFn(e)) throw asUnknown(e, /empty signature/i.test(String(e && (e.message || e))));
      // Format-only retry — second attempt errors are also ambiguous if not reject
      try {
        const res2 = await provider.signAndSendTransaction({ transaction: payload });
        const sig2 = res2 && (res2.signature || res2);
        if (sig2) return sig2;
        throw asUnknown(new Error('empty signature on retry'), true);
      } catch (e2) {
        if (isReject(e2)) throw e2;
        if (e2 && (e2.code === 'SOLANA_SEND_UNKNOWN' || e2.code === 'SOLANA_EMPTY_SIGNATURE')) throw e2;
        throw asUnknown(e2 || e, false);
      }
    }
  }

  /**
   * Typed classification for gwDsSubmit catch (D01).
   * Prefer err.code — message text is not the protocol.
   */
  function classifySwapExecError(err) {
    const code = err && (err.code ?? err.error?.code);
    if (code === 4001 || code === '4001' || code === 'ACTION_REJECTED') {
      return { kind: 'cancelled', keepLock: false, stage: 'cancelled' };
    }
    if (isWalletUserRejection(err)) {
      return { kind: 'cancelled', keepLock: false, stage: 'cancelled' };
    }
    const unknownCodes = new Set([
      'SOLANA_SEND_UNKNOWN',
      'SOLANA_EMPTY_SIGNATURE',
      'SEND_UNKNOWN',
      'EVM_SEND_UNKNOWN',
      'TON_SEND_UNKNOWN',
      'TRON_SEND_UNKNOWN',
    ]);
    if (unknownCodes.has(code)) {
      return { kind: 'unknown', keepLock: true, stage: 'unknown' };
    }
    const msg = String(err?.message || err?.error?.message || err || '');
    if (/timed out|timeout|check Activity|already sent|result unknown|Phantom Activity|before retrying|unknown —/i.test(msg)) {
      return { kind: 'unknown', keepLock: true, stage: 'unknown' };
    }
    return { kind: 'failed', keepLock: false, stage: 'failed' };
  }

  /**
   * Parse getSignatureStatuses JSON-RPC body (D03).
   * Official shape: result.value[0] — not result[0].
   * @returns {{ outcome: 'completed'|'failed'|'pending'|'rpc_error'|'empty', status?: object, error?: any }}
   */
  function parseSolanaSignatureStatuses(rpcJson) {
    if (!rpcJson || typeof rpcJson !== 'object') return { outcome: 'empty' };
    if (rpcJson.error) return { outcome: 'rpc_error', error: rpcJson.error };
    const value = rpcJson.result?.value;
    const list = Array.isArray(value) ? value : (Array.isArray(rpcJson.result) ? rpcJson.result : null);
    if (!list || !list.length) return { outcome: 'empty' };
    const st = list[0];
    if (st == null) return { outcome: 'pending', status: null };
    if (st.err) return { outcome: 'failed', status: st, error: st.err };
    const conf = String(st.confirmationStatus || '');
    if (conf === 'confirmed' || conf === 'finalized') {
      return { outcome: 'completed', status: st };
    }
    return { outcome: 'pending', status: st };
  }

  /**
   * Classify Tron gettransactioninfobyid payload (D04).
   * receipt presence ≠ success. Positive recognition of SUCCESS only.
   */
  function classifyTronTxInfo(info, expectTxId) {
    if (!info || typeof info !== 'object') return { outcome: 'empty' };
    const keys = Object.keys(info);
    if (!keys.length) return { outcome: 'empty' };
    const id = info.id || info.txID || info.txid || '';
    if (expectTxId && id && String(id).toLowerCase() !== String(expectTxId).toLowerCase()) {
      return { outcome: 'mismatch', id };
    }
    const receipt = info.receipt || null;
    if (!receipt && !info.blockNumber && !info.block_timestamp) {
      return { outcome: 'pending' };
    }
    const result = String(receipt?.result || '').toUpperCase();
    const FAIL = new Set([
      'FAILED', 'REVERT', 'OUT_OF_ENERGY', 'OUT_OF_TIME', 'OUTOFENERGY',
      'OUTOFTIME', 'BAD_JUMP_DESTINATION', 'ILLEGAL_OPERATION', 'STACK_TOO_SMALL',
      'STACK_TOO_LARGE', 'OUT_OF_MEMORY', 'TRANSFER_FAILED',
    ]);
    if (result && FAIL.has(result)) {
      return { outcome: 'failed', result, receipt };
    }
    // Positive success only
    if (result === 'SUCCESS' || result === 'SUCESS') {
      return { outcome: 'completed', result, receipt };
    }
    // Receipt / block without explicit SUCCESS — not success
    if (receipt && !result) return { outcome: 'unknown', receipt };
    if (result) return { outcome: 'unknown', result, receipt };
    return { outcome: 'pending', receipt };
  }

  /** eth_getTransactionReceipt status (D05). null receipt = still pending. */
  function classifyEvmReceipt(receipt) {
    if (receipt == null) return { outcome: 'pending' };
    if (typeof receipt !== 'object') return { outcome: 'empty' };
    const st = receipt.status;
    if (st === '0x1' || st === 1 || st === true) return { outcome: 'completed', receipt };
    if (st === '0x0' || st === 0 || st === false) return { outcome: 'failed', receipt };
    return { outcome: 'unknown', receipt };
  }

  /**
   * USD price impact from aggregator quote fields (xStocks / DEX guard).
   * Prefer explicit amountOutUsd when the provider returns it (Kyber routeSummary).
   * @returns {{ impact: number, inUsd: number, outUsd: number, blocked: boolean }}
   */
  function quoteUsdImpact({ amountInUsd, amountOutUsd, maxImpact = 0.05 } = {}) {
    const inUsd = Number(amountInUsd);
    const outUsd = Number(amountOutUsd);
    if (!(inUsd > 0) || !(outUsd >= 0) || !Number.isFinite(inUsd) || !Number.isFinite(outUsd)) {
      return { impact: NaN, inUsd: inUsd || 0, outUsd: outUsd || 0, blocked: false };
    }
    const impact = Math.max(0, (inUsd - outUsd) / inUsd);
    const cap = Number(maxImpact);
    const lim = Number.isFinite(cap) && cap > 0 ? cap : 0.05;
    return { impact, inUsd, outUsd, blocked: impact > lim };
  }

  /** Score an xStock quote by USD out when known; else token amount (legacy). */
  function xstockQuoteValueScore(q, { refPrice, buy } = {}) {
    if (!q) return 0;
    const outUsd = Number(q.amountOutUsd ?? q.outUsd ?? q._outUsd);
    if (outUsd > 0 && Number.isFinite(outUsd)) return outUsd;
    if (typeof q.toAmount !== 'bigint' || q.toAmount <= 0n) return 0;
    const dec = Number(q.outDecimals) > 0 ? Number(q.outDecimals) : 18;
    const tokens = Number(q.toAmount) / (10 ** dec);
    const px = Number(refPrice);
    if (buy && px > 0 && Number.isFinite(tokens)) return tokens * px;
    return tokens;
  }

  /**
   * Whether finally-block may clear the active op (D02).
   * submitted/unknown/bridging stay active for monitors + reload.
   */
  function shouldClearSwapOpAfterSubmit(stage) {
    const s = String(stage || '');
    return /^(completed|failed|cancelled|refunded|partial)$/i.test(s);
  }

  /**
   * Active chip wins over stale __gwDsUserPickedFrom.nonevm (C03).
   * activeChip: { cid?: number, nonevm?: string } | null
   */
  function resolveSwapUiNamespace({ activeChip, pickedFrom } = {}) {
    if (activeChip && activeChip.cid) {
      return { namespace: 'evm', chainId: Number(activeChip.cid), nonevm: null };
    }
    if (activeChip && activeChip.nonevm) {
      const kind = String(activeChip.nonevm).toLowerCase();
      if (kind === 'sol') return { namespace: 'solana', chainId: null, nonevm: 'sol' };
      if (kind === 'trx') return { namespace: 'tron', chainId: null, nonevm: 'trx' };
      if (kind === 'btc') return { namespace: 'bitcoin', chainId: null, nonevm: 'btc' };
    }
    // Fallback only when no chip is selected
    const pf = String(pickedFrom?.nonevm || '').toLowerCase();
    if (pf === 'sol') return { namespace: 'solana', chainId: null, nonevm: 'sol' };
    if (pf === 'trx') return { namespace: 'tron', chainId: null, nonevm: 'trx' };
    const cid = Number(pickedFrom?.chainId || 0);
    if (cid > 0 && cid < 1e8) return { namespace: 'evm', chainId: cid, nonevm: null };
    return { namespace: 'evm', chainId: null, nonevm: null };
  }

  /**
   * Which confirmation path to resume after reload (C04).
   * Never send a Solana signature to LI.FI.
   */
  function pickResumeMonitorKind(op) {
    if (!op || typeof op !== 'object') return 'none';
    if (!shouldRestoreSwapOp(op)) return 'none';
    const ns = String(op.namespace || '').toLowerCase() || 'evm';
    const stage = String(op.stage || '');
    const hasProof = !!(op.hash || op.signature || op.boc);
    const cross = !!(op.crossChain
      || op.bridge
      || (op.toChainId && op.fromChainId && Number(op.toChainId) !== Number(op.fromChainId))
      || /bridging/i.test(stage));
    if (!hasProof) return 'lock_only';
    if (ns === 'solana') return 'solana';
    if (ns === 'tron') return 'tron';
    if (ns === 'evm' && cross) return 'lifi_bridge';
    if (ns === 'evm') return 'evm_receipt';
    return 'lock_only';
  }

  /**
   * Executed route only — never .find() from quote array (C06).
   * Priority: execResult.quote → lastExecQuote → null.
   */
  function pickExecutedQuote(execResult, { lastExecQuote } = {}) {
    if (execResult && typeof execResult === 'object' && execResult.quote && typeof execResult.quote === 'object') {
      return execResult.quote;
    }
    if (lastExecQuote && typeof lastExecQuote === 'object') return lastExecQuote;
    return null;
  }

  /** Exact amount-string equality for quote cache (C05) — no Number float compare. */
  function amountsEqualExact(a, b) {
    const ca = canonicalAmountString(a);
    const cb = canonicalAmountString(b);
    if (!ca || !cb) return false;
    return ca === cb;
  }

  function swapCtaModel(s) {
    if (s.busy || s.active) return { key: s.stage === 'unknown' ? 'unknown' : 'pending', enabled: false };
    if (!s.connected) return { key: 'connect', enabled: true, action: 'connect' };
    if (!(Number(s.amount) > 0)) return { key: 'amount', enabled: false };
    if (!s.pairValid) return { key: 'pair', enabled: false };
    if (s.ready) return { key: s.restored ? 'reconnect' : 'swap', enabled: true, action: 'swap' };
    if (/insufficient|not enough|не хватает|balance|gas/i.test(s.error || '')) return { key: 'balance', enabled: false };
    if (s.error) return { key: 'retry', enabled: true, action: 'refresh' };
    return { key: 'loading', enabled: false };
  }
  function orderTransition(order, op, now) {
    if (!order || !op || order.id !== op.orderId || (order.opId && order.opId !== op.id)) return order;
    if (order.account !== op.account || order.from !== op.from || order.to !== op.to
        || !amountsEqualExact(order.amt, op.amt)) return order;
    if (order.lastTerminalOpId === op.id) return order;
    const next = { ...order, opId: op.id, hash: op.hash || order.hash || '', updatedAt: now };
    if (op.stage === 'completed') {
      next.executed = (Number(order.executed) || 0) + 1;
      next.state = order.type === 'dca' ? 'active' : 'filled';
      next.nextAt = order.type === 'dca' ? now + Number(order.interval) : null;
      next.lastTerminalOpId = op.id;
      next.opId = null;
    } else if (['failed', 'cancelled', 'refunded', 'partial'].includes(op.stage)) {
      next.state = op.stage;
      next.lastTerminalOpId = op.id;
      next.opId = null;
    } else next.state = ['submitted', 'bridging', 'unknown'].includes(op.stage) ? op.stage : 'awaiting_signature';
    return next;
  }
  function boundOrderMatches(order, ctx) {
    if (!order || !ctx || order.account !== ctx.account || !amountsEqualExact(order.amt, ctx.amt)) return false;
    return ['from', 'to', 'fromChainId', 'toChainId', 'fromAddress', 'toAddress'].every(k => String(order[k] || '') === String(ctx[k] || ''));
  }
  function orderQuoteMeetsLimit(order, minimumOut, decimals) {
    if (order.type !== 'limit') return true;
    try {
      if (!/^\d+$/.test(String(minimumOut)) || !Number.isInteger(Number(decimals))) return false;
      const fraction = value => {
        const s = canonicalAmountString(value);
        if (!/^\d+(\.\d+)?$/.test(s)) throw new Error('decimal');
        const [a,b = ''] = s.split('.');
        return [BigInt(a+b), 10n ** BigInt(b.length)];
      };
      const [an,ad] = fraction(order.amt), [pn,pd] = fraction(order.price);
      return BigInt(minimumOut) * ad * pd >= an * pn * 10n ** BigInt(decimals);
    } catch (_) { return false; }
  }

  return {
    swapCtaModel, orderTransition, boundOrderMatches, orderQuoteMeetsLimit,
    normalizeRpcTxCalldata,
    normalizeRpcTxValue,
    canonicalAmountString,
    isWalletUserRejection,
    shouldRestoreSwapOp,
    bridgeMonitorOwnsOp,
    slippageToFraction,
    slippageToBps,
    slippageToOdosPercent,
    slippageToSquidPercent,
    pickExecBridgeMeta,
    normalizeExecResult,
    findMatchingOutboundTx,
    requiresMandatoryPreSignRefresh,
    isSolanaFormatError,
    shouldRetrySolanaSignShape,
    solSignAndSendWithPolicy,
    classifySwapExecError,
    parseSolanaSignatureStatuses,
    classifyTronTxInfo,
    classifyEvmReceipt,
    quoteUsdImpact,
    xstockQuoteValueScore,
    shouldClearSwapOpAfterSubmit,
    resolveSwapUiNamespace,
    pickResumeMonitorKind,
    pickExecutedQuote,
    amountsEqualExact,
  };
});
