/**
 * LiFi quote proxy with Redis cache — account/slippage/fee bound (F01).
 * Informative (dummy) quotes never share executable calldata cache slots.
 */
import axios from 'axios';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { getRedis } from '../utils/redis.js';
import { parseAmountToUnits } from './swap-amount.js';
import {
  assertQuoteMatchesContext,
  buildQuoteContext,
  executableCacheKey,
  isDummyAccount,
  normalizeAddr,
  normalizeSlippage,
  stripExecutableFields,
  SWAP_QUOTE_CACHE_VERSION,
} from './swap-quote-context.js';

const LIFI = 'https://li.quest/v1';
const ZERO = '0x0000000000000000000000000000000000000000';
const INTEGRATOR = 'grom-exchange';
const LIFI_API_KEY = String(process.env.LIFI_API_KEY || '').trim();
/** Platform fee on LI.FI integrator path — keep in sync with frontend GW_LIFI_FEE_PCT. */
const LIFI_FEE_PCT = String(process.env.GROM_LIFI_FEE_PCT || '0.002');
/** Prefer env, then liquidity.feeReceiver from config (Instant Swap treasury). */
function resolveLifiFeeAddr() {
  const fromEnv = normalizeAddr(process.env.GROM_LIFI_FEE_ADDR || '');
  if (fromEnv) return fromEnv;
  try {
    const fromCfg = normalizeAddr(config.liquidity?.feeReceiver || '');
    if (fromCfg) return fromCfg;
  } catch (_) {}
  return normalizeAddr('0xCFeF272536D6E91A4945063d40ac7CbA7Eb657B5') || '';
}
const LIFI_FEE_ADDR = resolveLifiFeeAddr();

/** Public HTTP clients may not disable GROM fee via skipFee/noFee. */
export function publicClientFeeFlags(_body) {
  return { skipFee: false };
}

/** Curated token addresses (must match frontend GW_OC_SWAP). Fallback when body has no 0x address. */
const TOKENS = {
  1: {
    ETH: ZERO, WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    LINK: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    UNI: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
  },
  56: {
    BNB: ZERO, USDT: '0x55d398326f99059fF775485246999027B3197955',
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    BTC: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
    ETH: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
    CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
  },
  42161: {
    ETH: ZERO, WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    WBTC: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548',
    LINK: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
  },
  137: {
    MATIC: ZERO, POL: ZERO,
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    WBTC: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
    WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  },
  8453: {
    ETH: ZERO, WETH: '0x4200000000000000000000000000000000000006',
    USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    AERO: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
  },
  10: {
    ETH: ZERO, WETH: '0x4200000000000000000000000000000000000006',
    USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    USDC: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    OP: '0x4200000000000000000000000000000000000042',
  },
  43114: {
    AVAX: ZERO, USDT: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
    USDC: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    JOE: '0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd',
  },
  59144: {
    ETH: ZERO, WETH: '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f',
    USDC: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff',
    USDT: '0xA219439258ca9da29E9Cc4cE5596924745e12B93',
  },
};

const DECIMALS = {
  ETH: 18, WETH: 18, BNB: 18, MATIC: 18, POL: 18, AVAX: 18,
  USDT: 6, USDC: 6, DAI: 18, WBTC: 8, BTC: 18,
  LINK: 18, UNI: 18, ARB: 18, OP: 18, AERO: 18, CAKE: 18, JOE: 18,
};

const CHAIN_DECIMALS = {
  56: { USDT: 18, USDC: 18, BNB: 18, BTC: 18, BUSD: 18, ETH: 18, CAKE: 18 },
};

function tokenAddr(chainId, sym) {
  const cid = Number(chainId);
  const s = String(sym || '').toUpperCase();
  const map = TOKENS[cid];
  if (!map) return null;
  let raw = null;
  if (map[s]) raw = map[s];
  else if (s === 'BTC' && map.WBTC) raw = map.WBTC;
  else if (s === 'WETH' && map.ETH) raw = map.ETH;
  // LI.FI matches token addresses case-sensitively on some chains (ETH mainnet
  // rejected mixed-case USDC that ≠ EIP-55). Always send lowercase 0x…
  return raw ? (normalizeAddr(raw) || String(raw).toLowerCase()) : null;
}

function dec(chainId, sym) {
  const s = String(sym || '').toUpperCase();
  const cid = Number(chainId);
  if (CHAIN_DECIMALS[cid]?.[s] != null) return CHAIN_DECIMALS[cid][s];
  return DECIMALS[s] ?? 18;
}

const TTL = () => Math.max(8, config.quoteCache?.ttlSec ?? 15);
const BRIDGE_TTL = () => Math.max(45, (config.quoteCache?.ttlSec ?? 15) * 3);

async function readCache(key) {
  try {
    const redis = getRedis();
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit);
  } catch (err) {
    logger.debug({ err: err.message }, 'oc-quote cache read skip');
  }
  return null;
}

async function writeCache(key, out, ttlSec) {
  try {
    const redis = getRedis();
    await redis.setex(key, ttlSec, JSON.stringify(out));
  } catch (err) {
    logger.debug({ err: err.message }, 'oc-quote cache write skip');
  }
}

function isRateLimited(data, status) {
  if (status === 429) return true;
  const msg = String(data?.message || data?.code || '').toLowerCase();
  return msg.includes('rate limit') || data?.code === 1005;
}

const LIFI_MAX_INFLIGHT = Math.max(2, Number(process.env.GROM_LIFI_MAX_INFLIGHT || 6));
const LIFI_MAX_QUEUE = Math.max(8, Number(process.env.GROM_LIFI_MAX_QUEUE || 64));
const LIFI_QUEUE_WAIT_MS = Math.max(1000, Number(process.env.GROM_LIFI_QUEUE_WAIT_MS || 8000));
let _lifiInflight = 0;
const _lifiWait = [];
function acquireLifiSlot() {
  if (_lifiInflight < LIFI_MAX_INFLIGHT) {
    _lifiInflight++;
    return Promise.resolve();
  }
  if (_lifiWait.length >= LIFI_MAX_QUEUE) {
    const e = new Error('lifi queue full');
    e.status = 429;
    return Promise.reject(e);
  }
  return new Promise((resolve, reject) => {
    const entry = {
      resolve,
      reject,
      t: setTimeout(() => {
        const i = _lifiWait.indexOf(entry);
        if (i >= 0) _lifiWait.splice(i, 1);
        const e = new Error('lifi queue timeout');
        e.status = 504;
        reject(e);
      }, LIFI_QUEUE_WAIT_MS),
    };
    _lifiWait.push(entry);
  });
}
function releaseLifiSlot() {
  const next = _lifiWait.shift();
  if (next) {
    clearTimeout(next.t);
    next.resolve(); /* slot transferred — leave _lifiInflight unchanged */
  } else {
    _lifiInflight = Math.max(0, _lifiInflight - 1);
  }
}

/**
 * Point cleanup helper for ops: SCAN+DEL only legacy pre-v2 ocquote keys.
 * Does NOT flush Redis. Call manually from a one-off script / admin job.
 */
export async function planLegacyOcQuoteKeyCleanup(scanFn) {
  const ns = config.redis?.namespace || 'grom:';
  const pattern = `${ns}ocquote:*`;
  const legacy = [];
  if (typeof scanFn !== 'function') {
    return {
      pattern,
      keepPrefix: `${ns}ocquote:${SWAP_QUOTE_CACHE_VERSION}:`,
      note: 'Pass ioredis scan stream to collect keys not matching keepPrefix, then DEL in batches.',
      legacy,
    };
  }
  for await (const key of scanFn(pattern)) {
    if (!String(key).includes(`ocquote:${SWAP_QUOTE_CACHE_VERSION}:`)) legacy.push(key);
  }
  return { pattern, keepPrefix: `${ns}ocquote:${SWAP_QUOTE_CACHE_VERSION}:`, legacy };
}

export async function fetchLifiOcQuote(body, deps = {}) {
  const httpGet = typeof deps.httpGet === 'function'
    ? deps.httpGet
    : (url, opts) => axios.get(url, opts);
  const readCacheFn = typeof deps.readCache === 'function' ? deps.readCache : readCache;
  const writeCacheFn = typeof deps.writeCache === 'function' ? deps.writeCache : writeCache;
  const fromChainId = Number(body?.fromChainId || body?.chainId);
  const toChainId = Number(body?.toChainId || fromChainId);
  const fromSym = String(body?.fromSym || '').toUpperCase();
  const toSym = String(body?.toSym || '').toUpperCase();
  const rawAmt = body?.amountStr != null ? body.amountStr : (body?.amtNum ?? body?.amount);
  const fromAddressRaw = String(body?.fromAddress || body?.account || '').toLowerCase();
  const toAddressRaw = String(body?.toAddress || body?.recipient || fromAddressRaw || '').toLowerCase();
  const slippage = normalizeSlippage(body?.slippage, '0.005');

  if (!fromChainId || !toChainId || !fromSym || !toSym || rawAmt == null || rawAmt === '') {
    const err = new Error('bad params');
    err.status = 400;
    err.code = 'bad_params';
    throw err;
  }
  if (!TOKENS[fromChainId] && !(normalizeAddr(body?.fromToken))) {
    const err = new Error(`unsupported from chain ${fromChainId}`);
    err.status = 400;
    err.code = 'unsupported_chain';
    throw err;
  }

  const inAddr = normalizeAddr(body?.fromToken) || tokenAddr(fromChainId, fromSym);
  const outAddr = normalizeAddr(body?.toToken) || tokenAddr(toChainId, toSym);
  if (!inAddr || !outAddr) {
    const err = new Error(`token not mapped on chain ${fromChainId}/${toChainId}`);
    err.status = 400;
    err.code = 'token_not_mapped';
    throw err;
  }

  const bodyInDec = Number(body?.fromDecimals);
  const inDec = Number.isInteger(bodyInDec) && bodyInDec >= 0 && bodyInDec <= 36
    ? bodyInDec
    : dec(fromChainId, fromSym);

  let fromAmount;
  try {
    // Prefer exact base units if client already computed them.
    if (body?.fromAmount != null && /^\d+$/.test(String(body.fromAmount))) {
      fromAmount = String(body.fromAmount);
      if (BigInt(fromAmount) <= 0n) throw Object.assign(new Error('fromAmount must be > 0'), { status: 400 });
    } else {
      fromAmount = parseAmountToUnits(rawAmt, inDec, { truncate: !!body?.truncateAmount }).toString();
    }
  } catch (e) {
    if (!e.status) e.status = 400;
    throw e;
  }

  const informative = isDummyAccount(fromAddressRaw) || body?.informative === true;
  /* Public clients cannot disable GROM fee — ignore skipFee/noFee from the wire. */
  const { skipFee } = publicClientFeeFlags(body);
  const fee = (!skipFee && LIFI_FEE_ADDR) ? LIFI_FEE_PCT : '';
  const feeAddress = (!skipFee && LIFI_FEE_ADDR) ? LIFI_FEE_ADDR : '';

  const ctx = buildQuoteContext({
    fromChainId,
    toChainId,
    fromToken: inAddr,
    toToken: outAddr,
    fromAmount,
    fromAddress: fromAddressRaw,
    toAddress: toAddressRaw,
    slippage,
    fee,
    feeAddress,
    informative,
  });

  const ns = config.redis?.namespace || 'grom:';
  const key = executableCacheKey(ctx, ns);
  const cross = toChainId !== fromChainId;

  const cached = await readCacheFn(key);
  if (cached?.lifi?.estimate?.toAmount) {
    try {
      assertQuoteMatchesContext(cached, ctx, { requireTx: !ctx.informative });
      return { ...cached, cached: true, cacheVersion: SWAP_QUOTE_CACHE_VERSION };
    } catch (_) {
      /* corrupted / mismatched entry — ignore and refetch */
    }
  }

  const buildQs = (withFee) => {
    const qs = new URLSearchParams({
      fromChain: String(fromChainId),
      toChain: String(toChainId),
      fromToken: inAddr,
      toToken: outAddr,
      fromAmount,
      fromAddress: ctx.fromAddress,
      toAddress: ctx.toAddress,
      slippage,
      integrator: INTEGRATOR,
      order: 'RECOMMENDED',
    });
    if (withFee && feeAddress && fee) {
      qs.set('fee', fee);
      qs.set('feeAddress', feeAddress);
    }
    return qs;
  };

  const fetchUpstream = async (withFee) => {
    await acquireLifiSlot();
    try {
      const resp = await httpGet(`${LIFI}/quote?${buildQs(withFee)}`, {
        headers: {
          accept: 'application/json',
          ...(LIFI_API_KEY ? { 'x-lifi-api-key': LIFI_API_KEY } : {}),
        },
        timeout: 12000,
        validateStatus: (s) => s < 600,
      });
      return { httpStatus: resp.status, data: resp.data };
    } finally {
      releaseLifiSlot();
    }
  };

  const isFeeConfigErr = (data, status) => {
    const msg = String(data?.message || '');
    return status === 400 && (data?.code === 1011 || /not configured for collecting fees/i.test(msg));
  };

  let data;
  let httpStatus = 0;
  try {
    let got = await fetchUpstream(!!(feeAddress && fee));
    httpStatus = got.httpStatus;
    data = got.data;
    if (isFeeConfigErr(data, httpStatus) && feeAddress && fee) {
      /* Fail closed for executable quotes — do not silently strip fee. */
      if (!ctx.informative) {
        const e = new Error('lifi fee wallet not configured — cannot produce executable quote with GROM fee');
        e.status = 502;
        e.code = 'lifi_fee_unavailable';
        throw e;
      }
      logger.warn({ integrator: INTEGRATOR }, 'lifi fee wallet not configured (1011) — informative retry without fee');
      got = await fetchUpstream(false);
      httpStatus = got.httpStatus;
      data = got.data;
    }
    if (!data?.estimate?.toAmount) {
      if (isRateLimited(data, httpStatus) && cached?.lifi?.estimate?.toAmount) {
        return { ...cached, cached: true, stale: true, cacheVersion: SWAP_QUOTE_CACHE_VERSION };
      }
      const upstreamMsg = String(data?.message || '').trim();
      const err = new Error(upstreamMsg || 'no route');
      err.status = isRateLimited(data, httpStatus) ? 429 : 404;
      err.code = data?.code === 1003
        ? 'lifi_token_not_found'
        : (data?.code != null ? `lifi_${data.code}` : 'no_route');
      err.upstream = { status: httpStatus, code: data?.code ?? null, message: upstreamMsg || null };
      throw err;
    }
  } catch (err) {
    if (cached?.lifi?.estimate?.toAmount) {
      return { ...cached, cached: true, stale: true, cacheVersion: SWAP_QUOTE_CACHE_VERSION };
    }
    if (err.status === 404 || err.response?.status === 404) {
      // Preserve upstream reason (do not collapse to opaque "no route")
      if (err.code || (err.message && err.message !== 'no route' && !/^Request failed with status code/i.test(err.message))) {
        if (!err.status) err.status = 404;
        throw err;
      }
      const upstreamMsg = String(err.response?.data?.message || err.message || '').trim();
      const e = new Error(upstreamMsg || 'no route');
      e.status = 404;
      e.code = err.response?.data?.code === 1003 ? 'lifi_token_not_found' : (err.code || 'no_route');
      e.upstream = err.upstream || {
        status: err.response?.status || 404,
        code: err.response?.data?.code ?? null,
        message: upstreamMsg || null,
      };
      throw e;
    }
    if (isRateLimited(err.response?.data, err.response?.status) || err.status === 429) {
      const e = new Error('lifi rate limited');
      e.status = 429;
      throw e;
    }
    if (err.status === 400 || err.code) throw err;
    if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '')) {
      const e = new Error('lifi upstream timeout');
      e.status = 504;
      throw e;
    }
    logger.warn({ err: err.message, fromChainId, toChainId, fromSym, toSym }, 'lifi oc-quote failed');
    const e = new Error(err.message || 'lifi upstream error');
    e.status = 502;
    throw e;
  }

  try {
    assertQuoteMatchesContext({ lifi: data }, ctx, { requireTx: false });
  } catch (mismatch) {
    logger.warn({ details: mismatch.details }, 'lifi quote context mismatch');
    throw mismatch;
  }

  let storeLifi = data;
  if (ctx.informative) {
    storeLifi = stripExecutableFields(data);
  }

  const out = {
    lifi: storeLifi,
    context: {
      fromChainId,
      toChainId,
      fromToken: inAddr.toLowerCase(),
      toToken: outAddr.toLowerCase(),
      fromAmount,
      fromAddress: ctx.fromAddress,
      toAddress: ctx.toAddress,
      slippage,
      fee: fee || null,
      feeAddress: feeAddress || null,
      informative: ctx.informative,
    },
    fromChainId,
    toChainId,
    fromSym,
    toSym,
    amtNum: Number(rawAmt),
    fromAmount,
    cached: false,
    cacheVersion: SWAP_QUOTE_CACHE_VERSION,
    at: Date.now(),
    expiresAt: Date.now() + (cross ? BRIDGE_TTL() : TTL()) * 1000,
  };

  await writeCacheFn(key, out, cross ? BRIDGE_TTL() : TTL());
  return out;
}

export default { fetchLifiOcQuote, planLegacyOcQuoteKeyCleanup };
