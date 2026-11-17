/**
 * Token search for the swap picker beyond LI.FI's token list (owner, 17.11: ROCCO, GTA6, MIHAO,
 * DACITY from «Trending on DEXs» and NEW were «not on Ethereum» in the picker).
 *
 * DexScreener search (by name, symbol or contract, all networks) → pools on GROM's swap networks
 * with real liquidity → one row per token → LI.FI must know the token (it routes the swap, and
 * its answer gives the decimals). Answers are cached: query 5 min, token verdicts 12 h.
 */
import axios from 'axios';

const DS = 'https://api.dexscreener.com/latest/dex/search';
const LIFI = 'https://li.quest/v1';
const LIFI_API_KEY = String(process.env.LIFI_API_KEY || '').trim();
const SOL = 1151111081099710;

/** DexScreener chain slug → swap network. */
export const DS_CHAINS = {
  ethereum: 1, bsc: 56, base: 8453, arbitrum: 42161, polygon: 137, optimism: 10, avalanche: 43114,
  linea: 59144, solana: SOL, robinhood: 4663, hyperevm: 999, monad: 143, plasma: 9745, xlayer: 196,
};

const EVM_ADDR = /^0x[0-9a-fA-F]{40}$/;
const SOL_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function normalizeQuery(q) {
  return String(q || '').trim().replace(/\s+/g, ' ').slice(0, 64);
}

/**
 * DexScreener pairs → candidate tokens: the side of the pair that matches the query
 * (symbol/name contains it, or the contract equals it), liquidity ≥ minLiq, busiest pool per token.
 */
export function pickSearchTokens(pairs, query, { minLiq = 10_000, limit = 12 } = {}) {
  const q = normalizeQuery(query).toLowerCase();
  if (q.length < 2) return [];
  const best = new Map();
  for (const p of Array.isArray(pairs) ? pairs : []) {
    const chainId = DS_CHAINS[String(p?.chainId || '').toLowerCase()];
    if (!chainId) continue;
    const liq = Number(p?.liquidity?.usd) || 0;
    if (liq < minLiq) continue;
    for (const side of ['baseToken', 'quoteToken']) {
      const t = p?.[side] || {};
      let address = String(t.address || '').trim();
      const clean = (v) => String(v || '').replace(/[<>"'&`\\]/g, '').trim();
      const sym = clean(t.symbol);
      const name = clean(t.name);
      const hit = sym.toLowerCase().includes(q) || name.toLowerCase().includes(q) || address.toLowerCase() === q;
      if (!hit || !sym) continue;
      const okAddr = chainId === SOL ? SOL_ADDR.test(address) : EVM_ADDR.test(address);
      if (!okAddr) continue;
      if (chainId !== SOL) address = address.toLowerCase();
      const key = chainId + ':' + address;
      const vol = Number(p?.volume?.h24) || 0;
      const prev = best.get(key);
      if (prev && (prev.volumeUSD24H > vol || (prev.volumeUSD24H === vol && prev.liq >= liq))) continue;
      const img = side === 'baseToken' ? String(p?.info?.imageUrl || '') : '';
      const price = side === 'baseToken' ? Number(p?.priceUsd) : NaN;
      best.set(key, {
        sym: sym.toUpperCase().slice(0, 16), name: name.slice(0, 60), chainId, address,
        logo: /^https:\/\//.test(img) ? img : '',
        priceUSD: Number.isFinite(price) && price > 0 ? price : null,
        volumeUSD24H: vol, liq,
        _rank: sym.toLowerCase() === q ? 0 : sym.toLowerCase().startsWith(q) ? 1 : name.toLowerCase().startsWith(q) ? 2 : 3,
      });
    }
  }
  return [...best.values()]
    /* Volume first: copycats often show big (fake) liquidity but nobody trades them. */
    .sort((a, b) => a._rank - b._rank || b.volumeUSD24H - a.volumeUSD24H || b.liq - a.liq)
    .slice(0, limit);
}

export function createTokenSearch({ get = axios.get, now = Date.now } = {}) {
  const queries = new Map(); // q → { at, rows } / { inflight }
  const verdicts = new Map(); // chainId:address → { at, ok, decimals, logo, name }

  async function verify(t) {
    const key = t.chainId + ':' + t.address;
    const hit = verdicts.get(key);
    if (hit && now() - hit.at < 12 * 3600e3) return hit;
    let v = null;
    try {
      const { data } = await get(`${LIFI}/token`, {
        params: { chain: t.chainId, token: t.address }, timeout: 6000,
        headers: { Accept: 'application/json', ...(LIFI_API_KEY ? { 'x-lifi-api-key': LIFI_API_KEY } : {}) },
      });
      const dec = Number(data?.decimals);
      v = Number.isInteger(dec) && dec >= 0 && dec <= 36
        ? { at: now(), ok: true, decimals: dec, logo: String(data?.logoURI || ''), name: String(data?.name || '') }
        : { at: now(), ok: false };
    } catch (e) {
      const st = Number(e?.response?.status);
      if (st === 400 || st === 404) v = { at: now(), ok: false };
    }
    if (v) {
      verdicts.set(key, v);
      if (verdicts.size > 5000) verdicts.delete(verdicts.keys().next().value);
    }
    return v || { ok: false };
  }

  return async function search(query) {
    const q = normalizeQuery(query);
    if (q.length < 2) return [];
    const k = q.toLowerCase();
    const hit = queries.get(k);
    if (hit?.inflight) return hit.inflight;
    if (hit && now() - hit.at < 5 * 60_000) return hit.rows;
    const job = (async () => {
      let rows = [];
      try {
        const { data } = await get(DS, { params: { q }, timeout: 6000, headers: { Accept: 'application/json' } });
        const cands = pickSearchTokens(data?.pairs, q);
        const checked = await Promise.all(cands.map(async (t) => ({ t, v: await verify(t) })));
        rows = checked.filter(({ v }) => v.ok).map(({ t, v }) => ({
          sym: t.sym, name: String(v.name || t.name || t.sym).replace(/[<>"'&`\\]/g, '').slice(0, 60), chainId: t.chainId, address: t.address, decimals: v.decimals,
          logo: t.logo || (/^https:\/\//.test(v.logo) ? v.logo : ''), priceUSD: t.priceUSD,
          volumeUSD24H: t.volumeUSD24H, liquidityUSD: t.liq,
        }));
      } catch (_) { rows = []; }
      queries.set(k, { at: now(), rows });
      if (queries.size > 1000) queries.delete(queries.keys().next().value);
      return rows;
    })();
    queries.set(k, { at: 0, rows: [], inflight: job });
    return job;
  };
}

let singleton = null;
export function tokenSearch(q) {
  if (!singleton) singleton = createTokenSearch();
  return singleton(q);
}
