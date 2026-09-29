/**
 * Executable quote context — cache keys and pre-sign validation helpers.
 * Informative (dummy) quotes MUST NOT share cache entries with wallet-bound quotes.
 */

import { createHash } from 'node:crypto';

/** Bump when cache semantics change; old `ocquote:` keys are ignored (not deleted globally). */
export const SWAP_QUOTE_CACHE_VERSION = 'v2';

export const DUMMY_ACCOUNTS = new Set([
  '0x0000000000000000000000000000000000000001',
  '0x0000000000000000000000000000000000000000',
]);

export function normalizeAddr(a) {
  const s = String(a || '').trim().toLowerCase();
  if (/^0x[a-f0-9]{40}$/.test(s)) return s;
  return null;
}

export function normalizeSlippage(raw, fallback = '0.005') {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 0.5) return String(fallback);
  // Stable string form for cache keys (avoid 0.010 vs 0.01 collisions via fixed trim)
  const s = String(n);
  return s;
}

export function isDummyAccount(addr) {
  const a = normalizeAddr(addr);
  return !a || DUMMY_ACCOUNTS.has(a);
}

/**
 * Build a full executable quote context. Missing/dummy account → informative mode
 * (no transactionRequest may be cached under executable keys).
 */
export function buildQuoteContext(input = {}) {
  const fromChainId = Number(input.fromChainId || input.chainId);
  const toChainId = Number(input.toChainId || fromChainId);
  const fromToken = normalizeAddr(input.fromToken) || String(input.fromToken || '').toLowerCase() || null;
  const toToken = normalizeAddr(input.toToken) || String(input.toToken || '').toLowerCase() || null;
  const fromAddress = normalizeAddr(input.fromAddress || input.account);
  const toAddress = normalizeAddr(input.toAddress || input.recipient || input.fromAddress || input.account)
    || fromAddress;
  const fromAmount = String(input.fromAmount || '').replace(/^0x/, '');
  const slippage = normalizeSlippage(input.slippage);
  const fee = input.fee != null ? String(input.fee) : '';
  const feeAddress = normalizeAddr(input.feeAddress) || '';
  const informative = isDummyAccount(fromAddress) || !!input.informative;

  if (!fromChainId || !toChainId) {
    const err = new Error('chain required');
    err.status = 400;
    err.code = 'bad_params';
    throw err;
  }
  if (!fromToken || !toToken) {
    const err = new Error('token addresses required');
    err.status = 400;
    err.code = 'bad_params';
    throw err;
  }
  if (!/^\d+$/.test(fromAmount) || BigInt(fromAmount) <= 0n) {
    const err = new Error('fromAmount (base units) required');
    err.status = 400;
    err.code = 'bad_params';
    throw err;
  }

  return {
    namespace: 'evm',
    fromChainId,
    toChainId,
    fromToken,
    toToken,
    fromAmount,
    fromAddress: fromAddress || '0x0000000000000000000000000000000000000001',
    toAddress: toAddress || fromAddress || '0x0000000000000000000000000000000000000001',
    slippage,
    fee,
    feeAddress,
    informative,
  };
}

export function executableCacheKey(ctx, redisNamespace = 'grom:') {
  const c = buildQuoteContext(ctx);
  const kind = c.informative ? 'info' : 'exec';
  const raw = [
    SWAP_QUOTE_CACHE_VERSION,
    kind,
    c.namespace,
    c.fromChainId,
    c.toChainId,
    c.fromToken,
    c.toToken,
    c.fromAmount,
    c.fromAddress,
    c.toAddress,
    c.slippage,
    c.fee,
    c.feeAddress,
  ].join('|');
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 32);
  return `${redisNamespace}ocquote:${SWAP_QUOTE_CACHE_VERSION}:${kind}:${hash}`;
}

/**
 * Validate that a LI.FI (or compatible) quote payload matches the agreed context.
 * transactionRequest.to is the router — we check action.from/toAddress + amounts.
 * Executable quotes (requireTx) must carry a complete action context (R11).
 */
export function assertQuoteMatchesContext(quotePayload, ctx, opts = {}) {
  const c = buildQuoteContext(ctx);
  const lifi = quotePayload?.lifi || quotePayload;
  const action = lifi?.action;
  const estimate = lifi?.estimate || {};
  const tx = lifi?.transactionRequest || quotePayload?.transactionRequest;
  const requireTx = !!opts.requireTx && !c.informative;

  const errors = [];
  const NATIVE_ALIASES = new Set([
    '0x0000000000000000000000000000000000000000',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  ]);
  const isNativeAlias = (a) => a && NATIVE_ALIASES.has(a);

  if (requireTx) {
    if (!action || typeof action !== 'object') {
      errors.push('missing action on executable quote');
    }
    if (!tx?.to || !tx?.data) errors.push('missing transactionRequest');
  }

  const actFrom = normalizeAddr(action?.fromAddress);
  const actTo = normalizeAddr(action?.toAddress);
  if (!c.informative) {
    if (requireTx || actFrom) {
      if (!actFrom) errors.push('missing action.fromAddress');
      else if (actFrom !== c.fromAddress) errors.push(`fromAddress ${actFrom} != ${c.fromAddress}`);
    }
    if (requireTx || actTo) {
      if (!actTo) errors.push('missing action.toAddress');
      else if (actTo !== c.toAddress) errors.push(`toAddress ${actTo} != ${c.toAddress}`);
    }
    const txFrom = normalizeAddr(tx?.from);
    if (txFrom && txFrom !== c.fromAddress) errors.push(`tx.from ${txFrom} != ${c.fromAddress}`);
  }

  if (action) {
    if (requireTx || action.fromChainId != null) {
      if (!Number(action.fromChainId)) errors.push('missing action.fromChainId');
      else if (Number(action.fromChainId) !== c.fromChainId) errors.push('fromChainId mismatch');
    }
    if (requireTx || action.toChainId != null) {
      if (!Number(action.toChainId)) errors.push('missing action.toChainId');
      else if (Number(action.toChainId) !== c.toChainId) errors.push('toChainId mismatch');
    }

    const aFromTok = normalizeAddr(action.fromToken?.address || action.fromToken);
    const aToTok = normalizeAddr(action.toToken?.address || action.toToken);
    if (requireTx && !aFromTok) errors.push('missing action.fromToken');
    if (requireTx && !aToTok) errors.push('missing action.toToken');

    if (aFromTok) {
      const ctxNative = isNativeAlias(c.fromToken);
      const actNative = isNativeAlias(aFromTok);
      if (ctxNative || actNative) {
        if (!(ctxNative && actNative)) errors.push('fromToken native alias mismatch');
      } else if (aFromTok !== c.fromToken) {
        errors.push('fromToken mismatch');
      }
    }
    if (aToTok) {
      const ctxNative = isNativeAlias(c.toToken);
      const actNative = isNativeAlias(aToTok);
      if (ctxNative || actNative) {
        if (!(ctxNative && actNative)) errors.push('toToken native alias mismatch');
      } else if (aToTok !== c.toToken) {
        errors.push('toToken mismatch');
      }
    }

    const amt = String(action.fromAmount || estimate.fromAmount || '');
    if (requireTx && !amt) errors.push('missing fromAmount');
    if (amt && amt !== c.fromAmount) errors.push(`fromAmount ${amt} != ${c.fromAmount}`);

    if (action.slippage != null && Number(action.slippage) !== Number(c.slippage)) {
      errors.push(`slippage ${action.slippage} != ${c.slippage}`);
    }
  }

  if (errors.length) {
    const err = new Error('quote context mismatch: ' + errors.join('; '));
    err.status = 409;
    err.code = 'quote_context_mismatch';
    err.details = errors;
    throw err;
  }
  return true;
}

/** Strip personalized calldata before caching informative quotes. */
export function stripExecutableFields(lifiQuote) {
  if (!lifiQuote || typeof lifiQuote !== 'object') return lifiQuote;
  const copy = { ...lifiQuote };
  delete copy.transactionRequest;
  if (copy.estimate) {
    copy.estimate = { ...copy.estimate };
  }
  return copy;
}

export default {
  SWAP_QUOTE_CACHE_VERSION,
  buildQuoteContext,
  executableCacheKey,
  assertQuoteMatchesContext,
  stripExecutableFields,
  normalizeAddr,
  normalizeSlippage,
  isDummyAccount,
};
