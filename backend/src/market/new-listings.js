/**
 * «New listings» strip on the home page: coins CoinGecko listed recently that GROM can swap —
 * a contract on one of the swap networks that the swap's route provider (LI.FI) knows.
 * Every listing of the last 24 h is shown; listings of the last 14 days stay while they trade
 * big; the strip holds 20–30 coins (owner, 15.11).
 *
 * Without a CoinGecko Pro key the public coin list is diffed against the previous snapshot,
 * so the first hours after the very first start have nothing to show; the snapshot is kept
 * on disk across restarts. With a Pro key `/coins/list/new` is used directly.
 * Decimals come from LI.FI (once per token): a wrong decimals value would break the amounts
 * in the swap form, so a token LI.FI does not know is not shown.
 *
 * CoinGecko lists only 6–8 coins a day (16.11), so the strip is topped up to 20 with new DEX
 * tokens (owner's choice, 16.11): GeckoTerminal pools ≤ 14 days old that trade ≥ $100K a day with
 * ≥ $25K liquidity against ETH/USDC/USDT/BNB/SOL…, not already on CoinGecko, not named like a
 * top coin or a big brand, passing a GoPlus security check (no honeypot, taxes ≤ 10%, spread
 * holders) and routable by LI.FI.
 */
import axios from 'axios';
import fs from 'node:fs';

const CG_FREE = 'https://api.coingecko.com/api/v3';
const CG_PRO = 'https://pro-api.coingecko.com/api/v3';
const LIFI = 'https://li.quest/v1';
const GT = 'https://api.geckoterminal.com/api/v2';
const GOPLUS = 'https://api.gopluslabs.io/api/v1';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
/* A coin counts as new for 14 days (owner, 16.11). */
const NEW_MAX = 14 * DAY;

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

/** GeckoTerminal network → swap network, for the DEX top-up. */
export const NL_GT_NETS = [
  { gt: 'eth', chain: 'eth', chainId: 1 },
  { gt: 'bsc', chain: 'bsc', chainId: 56 },
  { gt: 'base', chain: 'base', chainId: 8453 },
  { gt: 'solana', chain: 'solana', chainId: 1151111081099710 },
  { gt: 'arbitrum', chain: 'arbitrum', chainId: 42161 },
  { gt: 'polygon_pos', chain: 'polygon', chainId: 137 },
  { gt: 'optimism', chain: 'optimism', chainId: 10 },
  { gt: 'avax', chain: 'avax', chainId: 43114 },
  { gt: 'linea', chain: 'linea', chainId: 59144 },
];
/* Real money on the other side of the pool (PONS, 16.11, traded only against an obscure token). */
const NL_QUOTES = new Set(['ETH', 'WETH', 'USDC', 'USDT', 'USDC.E', 'USDBC', 'USDT0', 'DAI', 'BNB', 'WBNB', 'SOL', 'WSOL', 'AVAX', 'WAVAX', 'POL', 'WPOL', 'WMATIC', 'USD1', 'FDUSD']);
const NL_MAJORS = new Set([...NL_QUOTES, 'WBTC', 'CBBTC', 'BTCB', 'BTC', 'USDE', 'STETH', 'WSTETH', 'TRX', 'WTRX', 'LINK', 'UNI']);
/* New tokens named after big companies are impersonations (or tokenized stocks, which live in «Stocks»). */
const NL_BRANDS = /\b(anthropic|openai|chatgpt|claude|gemini|google|alphabet|apple|tesla|nvidia|microsoft|amazon|meta|facebook|instagram|spacex|xai|blackrock|vanguard|visa|mastercard|paypal|coinbase|binance|robinhood|tether|circle|grom)\b/i;

/**
 * DEX candidates from GeckoTerminal pool lists (with `include=base_token,quote_token`).
 * One entry per token (its busiest pool), newest pools and real liquidity only.
 */
export function pickDexCandidates(pages, {
  now = Date.now(), oldAddrs = new Set(), majorSyms = new Set(), majorNames = new Set(),
  maxAgeMs = NEW_MAX, minVol = 100_000, minLiq = 25_000,
} = {}) {
  const best = new Map();
  for (const { net, json } of pages || []) {
    const inc = new Map(((json && json.included) || []).map((x) => [x.id, x.attributes || {}]));
    for (const p of (json && json.data) || []) {
      const a = p.attributes || {};
      const base = inc.get(p.relationships?.base_token?.data?.id) || {};
      const quote = inc.get(p.relationships?.quote_token?.data?.id) || {};
      const created = Date.parse(a.pool_created_at || '');
      if (!(created > 0) || now - created > maxAgeMs || now - created < 0) continue;
      const vol = Number(a.volume_usd?.h24) || 0;
      const liq = Number(a.reserve_in_usd) || 0;
      if (vol < minVol || liq < minLiq) continue;
      const sym = String(base.symbol || '').trim();
      const name = String(base.name || '').trim();
      if (!sym || !NL_QUOTES.has(String(quote.symbol || '').toUpperCase())) continue;
      if (NL_MAJORS.has(sym.toUpperCase()) || majorSyms.has(sym.toLowerCase()) || majorNames.has(name.toLowerCase())) continue;
      if (NL_SKIP.test(name) || NL_BRANDS.test(name) || NL_BRANDS.test(sym)) continue;
      let address = String(base.address || '').trim();
      const okAddr = net.chain === 'solana' ? SOL_ADDR.test(address) : EVM_ADDR.test(address);
      if (!okAddr) continue;
      if (EVM_ADDR.test(address)) address = address.toLowerCase();
      if (oldAddrs.has(address)) continue; // an established coin with a new pool, not a new coin
      const decimals = Number(base.decimals);
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) continue;
      const price = Number(a.base_token_price_usd);
      if (!(price > 0)) continue;
      const key = net.chainId + ':' + address;
      const prev = best.get(key);
      if (prev && prev.vol >= vol) continue;
      const chg = Number(a.price_change_percentage?.h24);
      best.set(key, {
        id: 'dex:' + key, sym: sym.toUpperCase().slice(0, 16), name: name.slice(0, 60),
        img: /^https:\/\//.test(String(base.image_url || '')) ? String(base.image_url) : '',
        price, chg: Number.isFinite(chg) ? chg : null, vol, mc: Number(a.market_cap_usd || a.fdv_usd) || 0,
        chain: net.chain, chainId: net.chainId, address, decimals,
        listedAt: new Date(created).toISOString(), src: 'dex',
      });
    }
  }
  return [...best.values()].sort((x, y) => y.vol - x.vol);
}

/** GoPlus verdict: true = looks tradable both ways, false = skip, null = no data (skip too). */
export function securityOk(chainId, info) {
  if (!info || typeof info !== 'object') return null;
  const one = (v) => String(v ?? '') === '1';
  if (Number(chainId) === 1151111081099710) {
    const st = (k) => String(info[k]?.status ?? '') === '1';
    if (st('mintable') || st('freezable') || st('balance_mutable_authority') || one(info.non_transferable)) return false;
    const fee = Number(info.transfer_fee?.fee_rate ?? info.transfer_fee?.rate ?? 0);
    if (fee > 0.1) return false;
    return true;
  }
  if (one(info.is_honeypot) || one(info.cannot_sell_all) || one(info.cannot_buy) || one(info.transfer_pausable)
    || one(info.owner_change_balance) || one(info.hidden_owner) || one(info.can_take_back_ownership) || one(info.selfdestruct)) return false;
  const tax = (v) => (v === '' || v == null ? 0 : Number(v));
  if (!(tax(info.sell_tax) <= 0.1) || !(tax(info.buy_tax) <= 0.1)) return false;
  const holders = Number(info.holder_count);
  if (Number.isFinite(holders) && holders < 200) return false;
  if (Number(info.creator_percent) > 0.2) return false;
  return true;
}

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
 *  2) listings of the last 14 days that trade big (≥ bigVol), by volume;
 *  3) if still under `min`, the next-best of those 14 days (≥ fillVol), by volume.
 */
export function buildRows(fresh, markets, decimals, {
  now = Date.now(), limit = 30, min = 20, minVol = 5000, bigVol = 1_000_000, fillVol = 100_000, dex = [],
} = {}) {
  const byId = new Map((markets || []).map((m) => [String(m.id), m]));
  const day = [];
  const week = [];
  for (const f of fresh || []) {
    const age = now - f.at;
    if (!(age >= 0 && age <= NEW_MAX)) continue;
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
  /* 4) still under `min`: new DEX tokens (already filtered and checked), by volume. */
  const have = new Set(rows.map((r) => r.chainId + ':' + String(r.address).toLowerCase()));
  const syms = new Set(rows.map((r) => String(r.sym).toUpperCase())); // same coin on another network: once
  for (const r of dex || []) {
    if (rows.length >= min) break;
    const k = r.chainId + ':' + String(r.address).toLowerCase();
    const sym = String(r.sym).toUpperCase();
    if (have.has(k) || syms.has(sym)) continue;
    have.add(k);
    syms.add(sym);
    rows.push(r);
  }
  return rows;
}

const ST_STATE = 'new_listings_state';
const ST_ROWS = 'new_listings_rows';

export function createNewListings({
  get = axios.get,
  now = Date.now,
  file = '/tmp/grom-new-listings.json',
  apiKey = String(process.env.COINGECKO_API_KEY || process.env.GROM_COINGECKO_API_KEY || '').trim(),
  lifiKey = String(process.env.LIFI_API_KEY || '').trim(),
  listEveryMs = 30 * 60_000,
  marketsTtlMs = 5 * 60_000,
  dexEveryMs = 30 * 60_000,
  dexOn = true,
  pause = (ms) => new Promise((r) => setTimeout(r, ms)),
  /* { get(key), set(key, value) } — Postgres in production (app_state), so a deploy does not empty the
     strip and the CoinGecko baseline survives restarts (owner, 17.11). */
  store = null,
} = {}) {
  const cgBase = apiKey ? CG_PRO : CG_FREE;
  const cgHeaders = { Accept: 'application/json', 'User-Agent': 'grom-exchange/1.0', ...(apiKey ? { 'x-cg-pro-api-key': apiKey } : {}) };
  /* known: every coin id seen so far; fresh: listings of the last 15 days; dec: decimals by coin id (-1: LI.FI does not know it). */
  let state = { known: null, fresh: [], dec: {}, listTs: 0 };
  let markets = { ts: 0, rows: [] };
  let listing = null;
  let marketing = null;
  /* DEX top-up: rows ready to show, addresses of coins CoinGecko already had, top-250 names. */
  let dex = { ts: 0, rows: [] };
  let dexing = null;
  let oldAddrs = null; // contract → CoinGecko id, for coins CoinGecko had before this run's fresh ones
  let oldCoins = new Map(); // id → coin (with platforms), same coins
  let majors = { ts: 0, syms: new Set(), names: new Set() };
  const dexOk = new Map(); // chainId:address → { ok, at } (security + LI.FI), 6 h
  let lastListTry = 0;

  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Array.isArray(raw?.known) && raw.known.length > 1000) {
      state = { known: new Set(raw.known), fresh: Array.isArray(raw.fresh) ? raw.fresh : [], dec: raw.dec || {}, listTs: Number(raw.listTs) || 0 };
    }
  } catch (_) {}

  function save() {
    const snap = { known: [...(state.known || [])], fresh: state.fresh, dec: state.dec, listTs: state.listTs };
    if (file) {
      try { fs.writeFileSync(file, JSON.stringify(snap), 'utf8'); } catch (_) {}
    }
    if (store && state.known) Promise.resolve(store.set(ST_STATE, snap)).catch(() => {});
  }

  /* Prices and DEX rows of the last good answer: shown right after a restart while fresh ones load. */
  function saveRows() {
    if (!store) return;
    const compact = markets.rows.map((m) => ({
      id: m.id, symbol: m.symbol, name: m.name, image: m.image, current_price: m.current_price,
      total_volume: m.total_volume, market_cap: m.market_cap, price_change_percentage_24h: m.price_change_percentage_24h,
    }));
    Promise.resolve(store.set(ST_ROWS, { markets: { ts: markets.ts, rows: compact }, dex })).catch(() => {});
  }

  /* Saved snapshot → memory, unless something fresher is already there. */
  const ready = !store ? Promise.resolve() : (async () => {
    try {
      const [st, rw] = await Promise.all([store.get(ST_STATE), store.get(ST_ROWS)]);
      if (st && Array.isArray(st.known) && st.known.length > 1000 && Number(st.listTs) > state.listTs) {
        state = { known: new Set(st.known), fresh: Array.isArray(st.fresh) ? st.fresh : [], dec: st.dec || {}, listTs: Number(st.listTs) || 0 };
      }
      if (rw && rw.markets && Array.isArray(rw.markets.rows) && Number(rw.markets.ts) > markets.ts) {
        markets = { ts: Number(rw.markets.ts), rows: rw.markets.rows };
      }
      if (rw && rw.dex && Array.isArray(rw.dex.rows) && Number(rw.dex.ts) > dex.ts) {
        dex = { ts: Number(rw.dex.ts), rows: rw.dex.rows };
      }
    } catch (_) {}
  })();
  const loaded = () => Promise.race([ready, pause(3000)]);

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
    state.fresh = state.fresh.filter((f) => now() - f.at <= NEW_MAX + DAY);
  }

  /* Contracts of every coin CoinGecko had before (minus the fresh ones): a «new» DEX pool of one of them is not a new coin. */
  function rememberOldAddrs(list) {
    const fresh = new Set(state.fresh.map((f) => f.id));
    const out = new Map();
    const coins = new Map();
    for (const c of list) {
      const id = String(c.id || '');
      if (!id || fresh.has(id)) continue;
      let mine = false;
      for (const [pid, a] of Object.entries(c.platforms || {})) {
        const v = String(a || '').trim();
        if (!v) continue;
        out.set(EVM_ADDR.test(v) ? v.toLowerCase() : v, id);
        if (NL_PLATFORMS[pid]) mine = true;
      }
      if (mine) coins.set(id, { id, symbol: c.symbol, name: c.name, platforms: c.platforms });
    }
    oldAddrs = out;
    oldCoins = coins;
  }

  /* A coin CoinGecko listed in the last 14 days but before our first snapshot looks «old» to the diff
     (MACCA, GATO, 16.11). Its logo upload time (image URL `?<unix>`) and a price history that
     starts within 14 days (ATH and ATL both within 15 days) say it is new: add it as a listing. */
  async function promoteRecentCg(hits) {
    const ids = [...new Set(hits.map((r) => oldAddrs.get(r.address)).filter(Boolean))].slice(0, 100);
    if (!ids.length) return;
    const { data } = await get(`${cgBase}/coins/markets`, {
      params: { vs_currency: 'usd', ids: ids.join(','), per_page: 250, page: 1 }, timeout: 15000, headers: cgHeaders,
    });
    const t = now();
    const add = [];
    for (const m of Array.isArray(data) ? data : []) {
      const ts = Number(String(m.image || '').split('?')[1]) * 1000;
      const ath = Date.parse(m.ath_date || '');
      const atl = Date.parse(m.atl_date || '');
      if (!(ts > 0 && t - ts >= 0 && t - ts <= NEW_MAX)) continue;
      if (!(ath > 0 && atl > 0 && t - ath <= NEW_MAX + DAY && t - atl <= NEW_MAX + DAY)) continue;
      const coin = oldCoins.get(String(m.id));
      if (coin) add.push({ ...coin, at: ts });
    }
    if (!add.length) return;
    addFresh(add, t);
    for (const c of add) {
      oldCoins.delete(c.id);
      for (const a of Object.values(c.platforms || {})) {
        const v = String(a || '').trim();
        if (v) oldAddrs.delete(EVM_ADDR.test(v) ? v.toLowerCase() : v);
      }
    }
    await fillDecimals();
    save();
  }

  async function refreshMajors() {
    if (now() - majors.ts < 12 * HOUR && majors.syms.size) return;
    const { data } = await get(`${cgBase}/coins/markets`, {
      params: { vs_currency: 'usd', order: 'market_cap_desc', per_page: 250, page: 1 }, timeout: 15000, headers: cgHeaders,
    });
    if (!Array.isArray(data) || data.length < 50) return;
    majors = { ts: now(), syms: new Set(data.map((c) => String(c.symbol || '').toLowerCase())), names: new Set(data.map((c) => String(c.name || '').toLowerCase())) };
  }

  /* One token: GoPlus security, then LI.FI must know it (the swap routes through LI.FI). */
  async function checkDex(r) {
    const key = r.chainId + ':' + r.address;
    const hit = dexOk.get(key);
    if (hit && now() - hit.at < 6 * HOUR) return hit.ok;
    let ok = false;
    let known = true;
    try {
      const sol = r.chainId === 1151111081099710;
      const url = sol ? `${GOPLUS}/solana/token_security` : `${GOPLUS}/token_security/${r.chainId}`;
      const { data } = await get(url, { params: { contract_addresses: r.address }, timeout: 10000, headers: { Accept: 'application/json' } });
      const res = data?.result || {};
      const info = res[r.address] || res[r.address.toLowerCase()] || Object.values(res)[0];
      ok = securityOk(r.chainId, info) === true;
    } catch (_) { ok = false; known = false; }
    await pause(1100);
    if (ok) {
      try {
        const headers = { Accept: 'application/json', ...(lifiKey ? { 'x-lifi-api-key': lifiKey } : {}) };
        const { data } = await get(`${LIFI}/token`, { params: { chain: r.chainId, token: r.address }, timeout: 10000, headers });
        ok = Number.isInteger(Number(data?.decimals));
        if (ok && Number(data.decimals) !== r.decimals) r.decimals = Number(data.decimals);
      } catch (e) {
        const st = Number(e?.response?.status);
        ok = false;
        if (!(st === 400 || st === 404)) known = false;
      }
      await pause(1100);
    }
    if (known) dexOk.set(key, { ok, at: now() });
    return ok;
  }

  async function refreshDex() {
    if (dexing) return dexing;
    dexing = (async () => {
      if (!oldAddrs) return; // wait for the first coin list
      try { await refreshMajors(); } catch (_) {}
      const pages = [];
      for (const net of NL_GT_NETS) {
        /* Busiest networks: a second page of top pools — new coins there often sit below the first 20. */
        const kinds = ['trending_pools?duration=24h&page=1&', 'pools?sort=h24_volume_usd_desc&page=1&'];
        if (['eth', 'bsc', 'base', 'solana'].includes(net.gt)) kinds.push('pools?sort=h24_volume_usd_desc&page=2&');
        for (const kind of kinds) {
          try {
            const { data } = await get(`${GT}/networks/${net.gt}/${kind}include=base_token,quote_token`, {
              timeout: 15000, headers: { Accept: 'application/json', 'User-Agent': 'grom-exchange/1.0' },
            });
            pages.push({ net, json: data });
          } catch (e) {
            if (Number(e?.response?.status) === 429) { await pause(60_000); }
          }
          await pause(2500);
        }
      }
      const all = pickDexCandidates(pages, { now: now(), oldAddrs: new Set(), majorSyms: majors.syms, majorNames: majors.names });
      try { await promoteRecentCg(all.filter((r) => oldAddrs.has(r.address))); } catch (_) {}
      const cands = all.filter((r) => !oldAddrs.has(r.address) && !state.fresh.some((f) => f.address === r.address)).slice(0, 30);
      const rows = [];
      for (const r of cands) {
        if (await checkDex(r)) rows.push(r);
      }
      dex = { ts: now(), rows };
      saveRows();
    })().finally(() => { dexing = null; });
    return dexing;
  }

  async function refreshList() {
    if (listing) return listing;
    listing = (async () => {
      await loaded(); // diff against the saved baseline, not a new one
      const t = now();
      if (apiKey) {
        /* Pro: the latest 200 listings with their activation time — no warm-up needed. */
        const { data } = await get(`${cgBase}/coins/list/new`, { timeout: 15000, headers: cgHeaders });
        const recent = (Array.isArray(data) ? data : []).filter((c) => t - Number(c.activated_at) * 1000 <= NEW_MAX);
        const { data: all } = await get(`${cgBase}/coins/list`, { params: { include_platform: true }, timeout: 30000, headers: cgHeaders });
        const byId = new Map((Array.isArray(all) ? all : []).map((c) => [c.id, c]));
        addFresh(recent.map((c) => ({ ...byId.get(c.id), id: c.id, at: Number(c.activated_at) * 1000 })), t);
        state.known = new Set(byId.keys());
        rememberOldAddrs(Array.isArray(all) ? all : []);
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
        rememberOldAddrs(list);
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
      const ids = state.fresh.filter((f) => now() - f.at <= NEW_MAX && state.dec[f.id] !== -1).map((f) => f.id).slice(-600);
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
      saveRows();
    })().catch((e) => {
      markets = { ts: now() - marketsTtlMs + 60_000, rows: markets.rows }; // retry in a minute, don't stall every request
      throw e;
    }).finally(() => { marketing = null; });
    return marketing;
  }

  async function getPayload() {
    await loaded();
    const needAddrs = dexOn && !oldAddrs && now() - lastListTry > 5 * 60_000;
    if (!state.known || needAddrs || now() - state.listTs > listEveryMs) {
      lastListTry = now();
      const p = refreshList().catch(() => {});
      if (!state.known) await Promise.race([p, new Promise((r) => setTimeout(r, 8000))]);
    }
    if (now() - markets.ts > marketsTtlMs) {
      const p = refreshMarkets().catch(() => {});
      if (!markets.ts) await Promise.race([p, new Promise((r) => setTimeout(r, 8000))]);
    }
    if (dexOn && oldAddrs && !dexing && now() - dex.ts > dexEveryMs) refreshDex().catch(() => {});
    const dec = new Map(Object.entries(state.dec).map(([k, v]) => [k, Number(v)]));
    const rows = buildRows(state.fresh, markets.rows, dec, { now: now(), dex: dex.rows.filter((r) => now() - Date.parse(r.listedAt) <= NEW_MAX) });
    return { rows, count: rows.length, warming: !state.known, ts: markets.ts || now() };
  }

  return { get: getPayload, refreshList, refreshMarkets, refreshDex, ready, _state: () => state, _dex: () => dex };
}

let _svc = null;
export function newListingsService() {
  if (!_svc) {
    /* Postgres snapshot (app_state) — loaded lazily so tests and tools that never call this stay DB-free. */
    const db = { mod: null };
    const kv = async () => { if (!db.mod) db.mod = (await import('../db/app-state.js')).appState(); return db.mod; };
    _svc = createNewListings({ store: { get: async (k) => (await kv()).get(k), set: async (k, v) => (await kv()).set(k, v) } });
  }
  return _svc;
}
