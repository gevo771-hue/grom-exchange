/**
 * Logos for swap-list tokens that the token list leaves blank (owner, 17.11: HyperEVM, Monad, Arc,
 * Plasma, X Layer, Solana and TRON lists showed letters instead of logos — BONK, WIF, JUP, SUN…).
 *
 * DexScreener `tokens/v1` (≤ 30 contracts per call, 300 req/min) gives each token's image when
 * the token is the base of one of its pools; for Solana, Jupiter's token list; GeckoTerminal
 * `tokens/multi` fills the rest when its
 * gentle budget allows. Answers are cached per token: found 7 days, not found 1 day (2 minutes when a source was busy).
 *
 * A verified token bridged to another network (OP on Arbitrum, ARB on BSC, sfrxETH on Linea…)
 * takes the logo of the same coin elsewhere: LI.FI links one coin across networks by `coinKey`.
 * Only for tokens LI.FI verified on their own network, so a look-alike never borrows a real logo.
 */
import axios from 'axios';
import config from '../config/index.js';

const DS = 'https://api.dexscreener.com/tokens/v1';
const LIFI_TOKENS = 'https://li.quest/v1/tokens';
/* Solana: Jupiter's token list has the icon of almost every mint (LI.FI's Solana logos sit on a
   storage service that no longer answers). */
const JUP_SEARCH = 'https://lite-api.jup.ag/tokens/v2/search';
const GT = 'https://api.geckoterminal.com/api/v2/networks';

/** Swap network → DexScreener slug / GeckoTerminal network. */
export const LOGO_CHAINS = {
  1: { ds: 'ethereum', gt: 'eth' },
  56: { ds: 'bsc', gt: 'bsc' },
  42161: { ds: 'arbitrum', gt: 'arbitrum' },
  137: { ds: 'polygon', gt: 'polygon_pos' },
  8453: { ds: 'base', gt: 'base' },
  10: { ds: 'optimism', gt: 'optimism' },
  43114: { ds: 'avalanche', gt: 'avax' },
  59144: { ds: 'linea', gt: 'linea' },
  4663: { ds: 'robinhood', gt: 'robinhood' },
  999: { ds: 'hyperevm', gt: 'hyperevm' },
  143: { ds: 'monad', gt: 'monad' },
  5042: { ds: 'arc', gt: null },
  9745: { ds: 'plasma', gt: 'plasma' },
  196: { ds: 'xlayer', gt: 'x-layer' },
  728126428: { ds: 'tron', gt: 'tron' },
  1151111081099710: { ds: 'solana', gt: 'solana', jup: true },
};

const EVM_ADDR = /^0x[0-9a-fA-F]{40}$/;
const B58 = /^[1-9A-HJ-NP-Za-km-z]{25,44}$/;

/** EVM contracts compare lower-case; Solana/TRON addresses are case-sensitive. */
export function logoKey(address) {
  const a = String(address || '').trim();
  if (EVM_ADDR.test(a)) return a.toLowerCase();
  return B58.test(a) ? a : '';
}

export function parseAddressList(raw, max = 30) {
  const out = [];
  const seen = new Set();
  for (const part of String(raw || '').split(',')) {
    const k = logoKey(part);
    if (!k || seen.has(k)) continue;
    if (/^0x0{40}$/i.test(k) || /^0xe{40}$/i.test(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= max) break;
  }
  return out;
}

const safeUrl = (u) => {
  const s = String(u || '');
  if (!/^https:\/\/[^\s"'<>]+$/.test(s)) return '';
  /* DexScreener: the bare image is 192 px; its resize parameters other than its own defaults fail to load (17.11). */
  if (/^https:\/\/cdn\.dexscreener\.com\//.test(s)) return s.split('?')[0];
  return s;
};

/** DexScreener pairs → { key: imageUrl } for the requested tokens that are a pool's base. */
export function logosFromPairs(pairs, wanted) {
  const want = new Set(wanted);
  const out = {};
  for (const p of Array.isArray(pairs) ? pairs : []) {
    const k = logoKey(p?.baseToken?.address);
    const img = safeUrl(p?.info?.imageUrl);
    if (k && img && want.has(k) && !out[k]) out[k] = img;
  }
  return out;
}

/* TRON and Solana lists carry almost no coinKey, so they are left out of the (daily) download. */
export const COIN_CHAINS = Object.keys(LOGO_CHAINS).map(Number).filter((c) => c !== 728126428 && c !== 1151111081099710);
const COIN_PREF = [1, 10, 42161, 8453, 56, 137, 43114];
const isVerified = (t) => String(t?.verificationStatus || '').toLowerCase() === 'verified'
  || (Array.isArray(t?.verificationStatusBreakdown) && t.verificationStatusBreakdown.some((x) => String(x?.result || '').toLowerCase() === 'verified'));

/**
 * LI.FI token lists → { coinOf: 'cid:key' → { ck, own }, logos: coinKey → [urls] }.
 * coinOf holds verified tokens only; logos come from tokens not flagged, main networks first.
 */
export function buildCoinIndex(tokens) {
  const coinOf = new Map();
  const logos = new Map();
  const rank = (c) => { const i = COIN_PREF.indexOf(Number(c)); return i < 0 ? 99 : i; };
  const lists = Object.entries(tokens || {}).sort((a, b) => rank(a[0]) - rank(b[0]));
  for (const [cid, list] of lists) {
    for (const t of Array.isArray(list) ? list : []) {
      const ck = String(t?.coinKey || '');
      const k = logoKey(t?.address);
      if (!ck || !k || String(t.verificationStatus || '').toLowerCase() === 'flagged') continue;
      const url = safeUrl(t.logoURI);
      if (isVerified(t)) coinOf.set(Number(cid) + ':' + k, { ck, own: url });
      if (url) {
        const arr = logos.get(ck) || [];
        if (arr.length < 4 && !arr.includes(url)) arr.push(url);
        logos.set(ck, arr);
      }
    }
  }
  return { coinOf, logos };
}

/** The same coin's logo from another listing (not the token's own, which is what failed). */
export function coinLogo(index, chainId, key) {
  const hit = index && index.coinOf.get(Number(chainId) + ':' + key);
  if (!hit) return '';
  const urls = index.logos.get(hit.ck) || [];
  return urls.find((u) => u !== hit.own) || hit.own || '';
}

async function fetchCoinIndex(get) {
  const headers = { Accept: 'application/json', 'User-Agent': 'grom-exchange/1.0' };
  const key = String(config.liquidity?.lifiApiKey || '').trim();
  if (key) headers['x-lifi-api-key'] = key;
  const { data } = await get(LIFI_TOKENS, {
    params: { chains: COIN_CHAINS.join(',') }, timeout: 20000, headers, maxContentLength: 40 * 1024 * 1024,
  });
  return buildCoinIndex(data?.tokens);
}

export function createTokenLogos({
  get = axios.get, now = Date.now, gtGapMs = 2500, gtWaitMs = 3000,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)), loadCoins = () => fetchCoinIndex(get),
} = {}) {
  const cache = new Map(); // chainId:key → { url, at, ttl }
  let gtNext = 0;
  const fresh = (hit) => hit && now() - hit.at < hit.ttl;
  /* One LI.FI download a day, only when a token needs it; a failed one is retried after 10 min. */
  const coins = { index: null, at: 0, retryAt: 0, inflight: null };
  async function coinIndex() {
    if (coins.index && now() - coins.at < 86400e3) return coins.index;
    if (!coins.inflight && now() >= coins.retryAt) {
      coins.inflight = Promise.resolve().then(loadCoins)
        .then((ix) => { if (ix && ix.coinOf) { coins.index = ix; coins.at = now(); } else coins.retryAt = now() + 600e3; })
        .catch(() => { coins.retryAt = now() + 600e3; })
        .finally(() => { coins.inflight = null; });
    }
    /* A day-old index keeps serving while the new one loads; the very first load is waited for. */
    if (!coins.index && coins.inflight) { try { await coins.inflight; } catch (_) {} }
    return coins.index;
  }

  /** meta.partial = true when a source did not answer (the caller may ask again in a few minutes). */
  return async function logos(chainId, addresses, meta = {}) {
    const chain = LOGO_CHAINS[Number(chainId)];
    const keys = parseAddressList(Array.isArray(addresses) ? addresses.join(',') : addresses);
    const result = {};
    if (!chain || !keys.length) return result;
    const missing = [];
    for (const k of keys) {
      const hit = cache.get(chainId + ':' + k);
      if (fresh(hit)) {
        if (hit.url) result[k] = hit.url;
        else if (hit.partial) meta.partial = true; // still waiting for a busy source
      } else missing.push(k);
    }
    if (!missing.length) return result;
    const found = {};
    try {
      const { data } = await get(`${DS}/${chain.ds}/${missing.join(',')}`, { timeout: 6000, headers: { Accept: 'application/json' } });
      Object.assign(found, logosFromPairs(data, missing));
    } catch (_) { meta.partial = true; return result; } // no answer: do not cache a miss
    let complete = true; // every source answered — only then a miss is kept for a day
    if (missing.some((k) => !found[k]) && COIN_CHAINS.includes(Number(chainId))) {
      const index = await coinIndex();
      if (!index) complete = false;
      for (const k of missing) if (!found[k]) { const u = coinLogo(index, chainId, k); if (u) found[k] = u; }
    }
    if (chain.jup && missing.some((k) => !found[k])) {
      const ask = missing.filter((k) => !found[k]);
      try {
        const { data } = await get(JUP_SEARCH, { params: { query: ask.join(',') }, timeout: 6000, headers: { Accept: 'application/json' } });
        for (const t of Array.isArray(data) ? data : []) {
          const k = String(t?.id || '');
          const url = safeUrl(t?.icon);
          if (url && ask.includes(k)) found[k] = url;
        }
      } catch (_) { complete = false; }
    }
    const rest = missing.filter((k) => !found[k]);
    /* GeckoTerminal: one call per gap; a request a moment behind another waits its turn (≤ 3 s). */
    const slot = Math.max(now(), gtNext);
    const useGt = rest.length && chain.gt && slot - now() <= gtWaitMs;
    if (rest.length && chain.gt && !useGt) complete = false;
    if (useGt) {
      gtNext = slot + gtGapMs;
      if (slot > now()) await sleep(slot - now());
      try {
        const { data } = await get(`${GT}/${chain.gt}/tokens/multi/${rest.join(',')}`, {
          timeout: 6000, headers: { Accept: 'application/json', 'User-Agent': 'grom-exchange/1.0' },
        });
        for (const t of data?.data || []) {
          const a = t?.attributes || {};
          const k = logoKey(a.address);
          const img = safeUrl(a.image_url);
          if (k && img && !/missing\.png/i.test(img) && rest.includes(k)) found[k] = img;
        }
      } catch (_) { complete = false; }
    }
    const t = now();
    for (const k of missing) {
      const partial = !found[k] && !complete; // a source was busy: ask again in 2 minutes
      cache.set(chainId + ':' + k, { url: found[k] || '', at: t, ttl: found[k] ? 7 * 86400e3 : (partial ? 120e3 : 86400e3), partial });
      if (found[k]) result[k] = found[k];
    }
    if (!complete) meta.partial = true;
    if (cache.size > 50_000) {
      for (const key of cache.keys()) { cache.delete(key); if (cache.size <= 40_000) break; }
    }
    return result;
  };
}

let singleton = null;
export function tokenLogos(chainId, addresses, meta) {
  if (!singleton) singleton = createTokenLogos();
  return singleton(chainId, addresses, meta);
}
