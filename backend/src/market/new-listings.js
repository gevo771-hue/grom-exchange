/**
 * «New listings» strip on the home page: coins that CoinGecko listed in the last 24 h
 * (about 20 a day) and that GROM can swap — they have a contract on a supported network.
 *
 * Without a CoinGecko Pro key the public coin list is diffed against the previous snapshot,
 * so the first hours after the very first start have nothing to show; the snapshot is kept
 * on disk across restarts. With a Pro key `/coins/list/new` is used directly.
 * Decimals come from GeckoTerminal (once per token): a wrong decimals value would break
 * the amounts in the swap form, so a token without known decimals is not shown.
 */
import axios from 'axios';
import fs from 'node:fs';

const CG_FREE = 'https://api.coingecko.com/api/v3';
const CG_PRO = 'https://pro-api.coingecko.com/api/v3';
const GT = 'https://api.geckoterminal.com/api/v2';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** CoinGecko platform id → swap network. Order matters only as a fallback (first platform of the coin wins). */
export const NL_PLATFORMS = {
  ethereum: { chain: 'eth', chainId: 1, gt: 'eth' },
  'binance-smart-chain': { chain: 'bsc', chainId: 56, gt: 'bsc' },
  base: { chain: 'base', chainId: 8453, gt: 'base' },
  'arbitrum-one': { chain: 'arbitrum', chainId: 42161, gt: 'arbitrum' },
  'polygon-pos': { chain: 'polygon', chainId: 137, gt: 'polygon_pos' },
  'optimistic-ethereum': { chain: 'optimism', chainId: 10, gt: 'optimism' },
  avalanche: { chain: 'avax', chainId: 43114, gt: 'avax' },
  linea: { chain: 'linea', chainId: 59144, gt: 'linea' },
  solana: { chain: 'solana', chainId: 1151111081099710, gt: 'solana' },
};

const EVM_ADDR = /^0x[0-9a-fA-F]{40}$/;
const NL_SKIP = /xstock|tokenized|ondo|\bbridged\b|\bwrapped\b|\bstock\b/i;
const SOL_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** First platform of the coin that GROM can swap: { platform, chain, chainId, gt, address } or null. */
export function pickPlatform(platforms) {
  for (const [pid, addrRaw] of Object.entries(platforms || {})) {
    const p = NL_PLATFORMS[pid];
    const address = String(addrRaw || '').trim();
    if (!p || !address) continue;
    if (p.chain === 'solana' ? !SOL_ADDR.test(address) : !EVM_ADDR.test(address)) continue;
    return { platform: pid, ...p, address: p.chain === 'solana' ? address : address.toLowerCase() };
  }
  return null;
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

/** Rows for the strip: newest listing first, only coins with a price and some trading. */
export function buildRows(fresh, markets, decimals, { now = Date.now(), maxAgeMs = DAY, limit = 30, minVol = 5000 } = {}) {
  const byId = new Map((markets || []).map((m) => [String(m.id), m]));
  const rows = [];
  for (const f of fresh || []) {
    if (!(now - f.at <= maxAgeMs)) continue;
    const m = byId.get(f.id);
    const price = Number(m?.current_price);
    if (!(price > 0)) continue;
    if (!(Number(m?.total_volume) >= minVol)) continue;
    const dec = decimals.get(f.id);
    if (!Number.isInteger(dec) || dec < 0 || dec > 36) continue;
    const chg = Number(m.price_change_percentage_24h);
    rows.push({
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
  rows.sort((a, b) => Date.parse(b.listedAt) - Date.parse(a.listedAt));
  return rows.slice(0, limit);
}

export function createNewListings({
  get = axios.get,
  now = Date.now,
  file = '/tmp/grom-new-listings.json',
  apiKey = String(process.env.COINGECKO_API_KEY || process.env.GROM_COINGECKO_API_KEY || '').trim(),
  listEveryMs = 30 * 60_000,
  marketsTtlMs = 5 * 60_000,
  pause = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  const cgBase = apiKey ? CG_PRO : CG_FREE;
  const cgHeaders = { Accept: 'application/json', 'User-Agent': 'grom-exchange/1.0', ...(apiKey ? { 'x-cg-pro-api-key': apiKey } : {}) };
  /* known: every coin id seen so far; fresh: listings seen in the last 48 h; dec: decimals by coin id. */
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
      const p = pickPlatform(c.platforms);
      if (!p) continue; // nothing to swap on GROM
      /* Tokenized stocks live in «Stocks» (with their own price protection); bridged/wrapped copies are not new assets. */
      if (NL_SKIP.test(`${id} ${c.name || ''}`)) continue;
      state.fresh.push({ id, symbol: c.symbol || '', name: c.name || '', at: Number(c.at) || at, chain: p.chain, chainId: p.chainId, gt: p.gt, address: p.address });
      have.add(id);
      markets.ts = 0; // new coins: fetch their prices on the next request instead of serving the old set
    }
    state.fresh = state.fresh.filter((f) => now() - f.at <= 2 * DAY);
  }

  async function refreshList() {
    if (listing) return listing;
    listing = (async () => {
      const t = now();
      if (apiKey) {
        /* Pro: the latest 200 listings with their activation time — no warm-up needed. */
        const { data } = await get(`${cgBase}/coins/list/new`, { timeout: 15000, headers: cgHeaders });
        const recent = (Array.isArray(data) ? data : []).filter((c) => t - Number(c.activated_at) * 1000 <= 2 * DAY);
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

  /* Decimals from GeckoTerminal, one token at a time (its free tier allows ~30 calls a minute). */
  async function fillDecimals() {
    for (const f of state.fresh) {
      if (state.dec[f.id] != null) continue;
      try {
        const { data } = await get(`${GT}/networks/${f.gt}/tokens/${f.address}`, { timeout: 10000, headers: { Accept: 'application/json' } });
        const d = Number(data?.data?.attributes?.decimals);
        if (Number.isInteger(d)) state.dec[f.id] = d;
      } catch (_) {}
      await pause(2200);
    }
    const keep = new Set(state.fresh.map((f) => f.id));
    for (const id of Object.keys(state.dec)) if (!keep.has(id)) delete state.dec[id];
  }

  async function refreshMarkets() {
    if (marketing) return marketing;
    marketing = (async () => {
      const ids = state.fresh.filter((f) => now() - f.at <= DAY).map((f) => f.id).slice(-200);
      if (!ids.length) { markets = { ts: now(), rows: [] }; return; }
      const { data } = await get(`${cgBase}/coins/markets`, {
        params: { vs_currency: 'usd', ids: ids.join(','), per_page: 250, page: 1, price_change_percentage: '24h' },
        timeout: 15000,
        headers: cgHeaders,
      });
      markets = { ts: now(), rows: Array.isArray(data) ? data : [] };
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
