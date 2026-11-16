/**
 * «New listings» strip on the home page: coins CoinGecko listed recently that GROM can swap —
 * a contract on one of the swap networks that the swap's route provider (LI.FI) knows.
 * Every listing of the last 24 h is shown; listings of the last 7 days stay while they trade
 * big; the strip holds 20–30 coins (owner, 15.11).
 *
 * Without a CoinGecko Pro key the public coin list is diffed against the previous snapshot,
 * so the first hours after the very first start have nothing to show; the snapshot is kept
 * on disk across restarts. With a Pro key `/coins/list/new` is used directly.
 * Decimals come from LI.FI (once per token): a wrong decimals value would break the amounts
 * in the swap form, so a token LI.FI does not know is not shown.
 */
import axios from 'axios';
import fs from 'node:fs';

const CG_FREE = 'https://api.coingecko.com/api/v3';
const CG_PRO = 'https://pro-api.coingecko.com/api/v3';
const LIFI = 'https://li.quest/v1';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** CoinGecko platform id → swap network: every network of the GROM swap that has tokens (GW_DS_CHAINS). */
export const NL_PLATFORMS = {
  ethereum: { chain: 'eth', chainId: 1 },
  'binance-smart-chain': { chain: 'bsc', chainId: 56 },
  base: { chain: 'base', chainId: 8453 },
  'arbitrum-one': { chain: 'arbitrum', chainId: 42161 },
  'polygon-pos': { chain: 'polygon', chainId: 137 },
  'optimistic-ethereum': { chain: 'optimism', chainId: 10 },
  avalanche: { chain: 'avax', chainId: 43114 },
  linea: { chain: 'linea', chainId: 59144 },
  robinhood: { chain: 'robinhood', chainId: 4663 },
  hyperevm: { chain: 'hyperevm', chainId: 999 },
  monad: { chain: 'monad', chainId: 143 },
  arc: { chain: 'arc', chainId: 5042 },
  plasma: { chain: 'plasma', chainId: 9745 },
  'x-layer': { chain: 'xlayer', chainId: 196 },
  solana: { chain: 'solana', chainId: 1151111081099710 },
  tron: { chain: 'tron', chainId: 728126428 },
};

const EVM_ADDR = /^0x[0-9a-fA-F]{40}$/;
const TRON_ADDR = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const NL_SKIP = /xstock|tokenized|ondo|\bbridged\b|\bwrapped\b|\bstock\b/i;
const SOL_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Every network of the coin that GROM can swap, in CoinGecko's order: [{ platform, chain, chainId, address }]. */
export function swapPlatforms(platforms) {
  const out = [];
  for (const [pid, addrRaw] of Object.entries(platforms || {})) {
    const p = NL_PLATFORMS[pid];
    const address = String(addrRaw || '').trim();
    if (!p || !address) continue;
    const ok = p.chain === 'solana' ? SOL_ADDR.test(address) : (p.chain === 'tron' ? TRON_ADDR.test(address) : EVM_ADDR.test(address));
    if (!ok) continue;
    out.push({ platform: pid, ...p, address: EVM_ADDR.test(address) ? address.toLowerCase() : address });
  }
  return out;
}
/** First network of the coin that GROM can swap, or null. */
export function pickPlatform(platforms) {
  return swapPlatforms(platforms)[0] || null;
}

/** Diff of two coin lists: coins present now but not in `known` (Set of ids). */
export function diffNewCoins(list, known) {
  const out = [];
  for (const c of Array.isArray(list) ? list : []) {
    const id = String(c?.id || '');
    if (id && !known.has(id)) out.push(c);
  }
  return out;
}

/**
 * Rows for the strip, 20–30 coins:
 *  1) every listing of the last 24 h that trades (≥ minVol), newest first;
 *  2) listings of the last 7 days that trade big (≥ bigVol), by volume;
 *  3) if still under `min`, the next-best of the week (≥ fillVol), by volume.
 */
export function buildRows(fresh, markets, decimals, {
  now = Date.now(), limit = 30, min = 20, minVol = 5000, bigVol = 1_000_000, fillVol = 100_000,
} = {}) {
  const byId = new Map((markets || []).map((m) => [String(m.id), m]));
  const day = [];
  const week = [];
  for (const f of fresh || []) {
    const age = now - f.at;
    if (!(age >= 0 && age <= WEEK)) continue;
    const m = byId.get(f.id);
    const price = Number(m?.current_price);
    if (!(price > 0)) continue;
    const vol = Number(m?.total_volume) || 0;
    if (vol < minVol) continue;
    const dec = decimals.get(f.id);
    if (!Number.isInteger(dec) || dec < 0 || dec > 36) continue;
    const chg = Number(m.price_change_percentage_24h);
    (age <= DAY ? day : week).push({
      id: f.id,
      sym: String(m.symbol || f.symbol || '').toUpperCase().slice(0, 16),
      name: String(m.name || f.name || '').slice(0, 60),
      img: /^https:\/\//.test(String(m.image || '')) ? String(m.image) : '',
      price,
      chg: Number.isFinite(chg) ? chg : null,
      vol: Number(m.total_volume) || 0,
      mc: Number(m.market_cap) || 0,
      chain: f.chain,
      chainId: f.chainId,
      address: f.address,
      decimals: dec,
      listedAt: new Date(f.at).toISOString(),
    });
  }
  day.sort((a, b) => Date.parse(b.listedAt) - Date.parse(a.listedAt));
  week.sort((a, b) => b.vol - a.vol);
  const rows = day.slice(0, limit);
  for (const r of week) if (rows.length < limit && r.vol >= bigVol) rows.push(r);
  for (const r of week) if (rows.length < min && r.vol < bigVol && r.vol >= fillVol) rows.push(r);
  return rows;
}

export function createNewListings({
  get = axios.get,
  now = Date.now,
  file = '/tmp/grom-new-listings.json',
  apiKey = String(process.env.COINGECKO_API_KEY || process.env.GROM_COINGECKO_API_KEY || '').trim(),
  lifiKey = String(process.env.LIFI_API_KEY || '').trim(),
  listEveryMs = 30 * 60_000,
  marketsTtlMs = 5 * 60_000,
  pause = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  const cgBase = apiKey ? CG_PRO : CG_FREE;
  const cgHeaders = { Accept: 'application/json', 'User-Agent': 'grom-exchange/1.0', ...(apiKey ? { 'x-cg-pro-api-key': apiKey } : {}) };
  /* known: every coin id seen so far; fresh: listings of the last 8 days; dec: decimals by coin id (-1: LI.FI does not know it). */
  let state = { known: null, fresh: [], dec: {}, listTs: 0 };
  let markets = { ts: 0, rows: [] };
  let listing = null;
  let marketing = null;

  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Array.isArray(raw?.known) && raw.known.length > 1000) {
      state = { known: new Set(raw.known), fresh: Array.isArray(raw.fresh) ? raw.fresh : [], dec: raw.dec || {}, listTs: Number(raw.listTs) || 0 };
    }
  } catch (_) {}

  function save() {
    if (!file) return;
    try {
      fs.writeFileSync(file, JSON.stringify({ known: [...state.known], fresh: state.fresh, dec: state.dec, listTs: state.listTs }), 'utf8');
    } catch (_) {}
  }

  function addFresh(coins, at) {
    const have = new Set(state.fresh.map((f) => f.id));
    for (const c of coins) {
      const id = String(c.id || '');
      if (!id || have.has(id)) continue;
      const alts = swapPlatforms(c.platforms);
      const p = alts[0];
      if (!p) continue; // nothing to swap on GROM
      /* Tokenized stocks live in «Stocks» (with their own price protection); bridged/wrapped copies are not new assets. */
      if (NL_SKIP.test(`${id} ${c.name || ''}`)) continue;
      state.fresh.push({ id, symbol: c.symbol || '', name: c.name || '', at: Number(c.at) || at, chain: p.chain, chainId: p.chainId, address: p.address,
        alts: alts.slice(1, 4).map((a) => ({ chain: a.chain, chainId: a.chainId, address: a.address })) });
      have.add(id);
      markets.ts = 0; // new coins: fetch their prices on the next request instead of serving the old set
    }
    state.fresh = state.fresh.filter((f) => now() - f.at <= WEEK + DAY);
  }

  async function refreshList() {
    if (listing) return listing;
    listing = (async () => {
      const t = now();
      if (apiKey) {
        /* Pro: the latest 200 listings with their activation time — no warm-up needed. */
        const { data } = await get(`${cgBase}/coins/list/new`, { timeout: 15000, headers: cgHeaders });
        const recent = (Array.isArray(data) ? data : []).filter((c) => t - Number(c.activated_at) * 1000 <= WEEK);
        const { data: all } = await get(`${cgBase}/coins/list`, { params: { include_platform: true }, timeout: 30000, headers: cgHeaders });
        const byId = new Map((Array.isArray(all) ? all : []).map((c) => [c.id, c]));
        addFresh(recent.map((c) => ({ ...byId.get(c.id), id: c.id, at: Number(c.activated_at) * 1000 })), t);
        state.known = new Set(byId.keys());
      } else {
        const { data } = await get(`${cgBase}/coins/list`, { params: { include_platform: true }, timeout: 30000, headers: cgHeaders });
        const list = Array.isArray(data) ? data : [];
        if (list.length < 1000) throw new Error('coin list too short');
        if (!state.known) {
          state.known = new Set(list.map((c) => String(c.id)));
        } else {
          addFresh(diffNewCoins(list, state.known), t);
          for (const c of list) state.known.add(String(c.id));
        }
      }
      state.listTs = t;
      await fillDecimals();
      save();
    })().finally(() => { listing = null; });
    return listing;
  }

  /* Decimals from LI.FI, one token at a time. LI.FI routes the swap, so a token it rejects is not tradable
     on GROM (-1, not asked again); a network error or rate limit is retried on the next run. */
  async function fillDecimals() {
    const headers = { Accept: 'application/json', ...(lifiKey ? { 'x-lifi-api-key': lifiKey } : {}) };
    let limited = false;
    for (const f of state.fresh) {
      while (!limited && state.dec[f.id] == null) {
        let again = false;
        try {
          const { data } = await get(`${LIFI}/token`, { params: { chain: f.chainId, token: f.address }, timeout: 10000, headers });
          const d = Number(data?.decimals);
          if (Number.isInteger(d)) state.dec[f.id] = d;
        } catch (e) {
          const st = Number(e?.response?.status);
          if (st === 400 || st === 404) {
            /* Not routable on this network — try the coin's next network, then give up on it. */
            const next = Array.isArray(f.alts) ? f.alts.shift() : null;
            if (next) { Object.assign(f, next); again = true; } else state.dec[f.id] = -1;
          }
          if (st === 429) limited = true;
        }
        await pause(1500);
        if (!again) break;
      }
      if (limited) break;
    }
    const keep = new Set(state.fresh.map((f) => f.id));
    for (const id of Object.keys(state.dec)) if (!keep.has(id)) delete state.dec[id];
  }

  async function refreshMarkets() {
    if (marketing) return marketing;
    marketing = (async () => {
      const ids = state.fresh.filter((f) => now() - f.at <= WEEK && state.dec[f.id] !== -1).map((f) => f.id).slice(-600);
      if (!ids.length) { markets = { ts: now(), rows: [] }; return; }
      const rows = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await get(`${cgBase}/coins/markets`, {
          params: { vs_currency: 'usd', ids: ids.slice(i, i + 200).join(','), per_page: 250, page: 1, price_change_percentage: '24h' },
          timeout: 15000,
          headers: cgHeaders,
        });
        if (Array.isArray(data)) rows.push(...data);
      }
      markets = { ts: now(), rows };
    })().catch((e) => {
      markets = { ts: now() - marketsTtlMs + 60_000, rows: markets.rows }; // retry in a minute, don't stall every request
      throw e;
    }).finally(() => { marketing = null; });
    return marketing;
  }

  async function getPayload() {
    if (!state.known || now() - state.listTs > listEveryMs) {
      const p = refreshList().catch(() => {});
      if (!state.known) await Promise.race([p, new Promise((r) => setTimeout(r, 8000))]);
    }
    if (now() - markets.ts > marketsTtlMs) {
      const p = refreshMarkets().catch(() => {});
      if (!markets.ts) await Promise.race([p, new Promise((r) => setTimeout(r, 8000))]);
    }
    const dec = new Map(Object.entries(state.dec).map(([k, v]) => [k, Number(v)]));
    const rows = buildRows(state.fresh, markets.rows, dec, { now: now() });
    return { rows, count: rows.length, warming: !state.known, ts: markets.ts || now() };
  }

  return { get: getPayload, refreshList, refreshMarkets, _state: () => state };
}

let _svc = null;
export function newListingsService() {
  if (!_svc) _svc = createNewListings();
  return _svc;
}
