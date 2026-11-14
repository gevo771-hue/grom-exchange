/**
 * Stocks section universe: every tokenized share GROM can route, grouped by ticker.
 *
 * Sources
 *  - the canonical xStock catalog (Backed API, 1.5K tickers; EVM + Solana deployments);
 *  - LI.FI token lists for the networks GROM swaps on: extra xStock deployments
 *    (HyperEVM, Monad), Robinhood Chain stock tokens, Ondo tokens and smaller
 *    wrappers. Only tokens that pass strict name/symbol/issuer rules are kept —
 *    never the general LI.FI token soup.
 *
 * Read-only market data. Execution happens in the user's wallet and keeps the
 * client-side price guards.
 */
import rateLimit from 'express-rate-limit';
import { stockCategory } from './stock-categories.js';

/** Networks the Stocks section can trade on (must be swappable in grom-wallet.js). */
export const STOCK_CHAINS = Object.freeze({
  solana: { key: 'solana', name: 'Solana', ds: 'solana' },
  1: { key: 'ethereum', name: 'Ethereum', ds: 'ethereum' },
  56: { key: 'bsc', name: 'BNB Chain', ds: 'bsc' },
  42161: { key: 'arbitrum', name: 'Arbitrum', ds: 'arbitrum' },
  10: { key: 'optimism', name: 'Optimism', ds: 'optimism' },
  8453: { key: 'base', name: 'Base', ds: 'base' },
  4663: { key: 'robinhood', name: 'Robinhood Chain', ds: 'robinhood' },
  999: { key: 'hyperevm', name: 'HyperEVM', ds: 'hyperevm' },
  143: { key: 'monad', name: 'Monad', ds: 'monad' },
});
export const LIFI_STOCK_CHAIN_IDS = Object.freeze([1, 56, 42161, 10, 8453, 4663, 999, 143]);

const EVM_ADDR = /^0x[a-fA-F0-9]{40}$/;
const SOL_MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TICKER = /^[A-Z][A-Z0-9]{0,6}(?:\.[A-Z])?$/;

export function cleanStockName(name) {
  return String(name || '')
    .replace(/\s*xStock$/i, '')
    .replace(/\s*\(Ondo Tokenized\)$/i, '')
    .replace(/\s*\(Reality Tokenized\)$/i, '')
    .replace(/\s*•\s*Robinhood Token$/i, '')
    .replace(/^Wrapped\s+(.*)\s+ST0x$/i, '$1')
    .replace(/^EQX Tokenized\s+/i, '')
    .trim();
}

export function parseCompactUsd(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  const m = String(v || '').replace(/,/g, '').match(/^\$?\s*([\d.]+)\s*([KMBT]?)$/i);
  if (!m) return null;
  const n = Number(m[1]) * ({ '': 1, K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[m[2].toUpperCase()] || 1);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Classify one LI.FI token. Returns null for anything that is not clearly a
 * tokenized share. xStock tokens are matched to the catalog by token symbol.
 */
export function classifyLifiStockToken(token, chainId) {
  const cid = Number(chainId);
  if (!STOCK_CHAINS[cid]) return null;
  const sym = String(token?.symbol || '').trim();
  const name = String(token?.name || '').trim();
  const address = String(token?.address || '').trim();
  if (!EVM_ADDR.test(address) || /^0x0{40}$/i.test(address)) return null;
  if (String(token?.verificationStatus || '').toLowerCase() === 'flagged') return null;
  const decimals = Number(token?.decimals);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;
  const priceUsd = Number(token?.priceUSD);
  const base = { chainId: cid, symbol: sym, address, decimals, priceUsd: priceUsd > 0 ? priceUsd : null, logo: String(token?.logoURI || '') };
  let kind = null;
  let ticker = null;
  if (/xStock$/i.test(name) && /^[A-Za-z0-9.]{1,12}x$/.test(sym)) {
    kind = 'x'; ticker = null;
  } else if (/\(Ondo Tokenized\)$/i.test(name) && /^[A-Z0-9.]{1,9}on$/.test(sym)) {
    kind = 'on'; ticker = sym.slice(0, -2);
  } else if (cid === 4663 && /^[A-Z][A-Z0-9.]{0,7}$/.test(sym)
      && (/^https:\/\/cdn\.robinhood\.com\/ncw_assets\//i.test(base.logo) || /•\s*Robinhood Token$/i.test(name))) {
    kind = 'rh'; ticker = sym;
  } else if (/ST0x$/.test(name) && /^wt[A-Z][A-Z0-9.]{0,7}$/.test(sym)) {
    kind = 'wt'; ticker = sym.slice(2);
  } else if (/\(Reality Tokenized\)$/i.test(name) && /^r[A-Z][A-Z0-9.]{0,7}$/.test(sym)) {
    kind = 'r'; ticker = sym.slice(1);
  } else if (/^EQX Tokenized /i.test(name) && /^EQ[A-Z][A-Z0-9.]{0,7}$/.test(sym)) {
    kind = 'eq'; ticker = sym.slice(2);
  }
  if (!kind) return null;
  if (ticker != null) {
    ticker = ticker.toUpperCase();
    if (!TICKER.test(ticker)) return null;
  }
  return { ...base, kind, ticker, name: cleanStockName(name) || ticker || sym };
}

function variantKey(v) {
  return `${v.c}:${v.c === 'solana' ? v.a : String(v.a).toLowerCase()}`;
}

function nameWords(name) {
  return cleanStockName(name).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/).filter((w) => w.length >= 3 && !['the', 'inc', 'corp', 'class', 'holdings', 'group', 'company'].includes(w));
}

/** Same company when the first meaningful word of both names matches. */
export function namesAgree(a, b) {
  const x = nameWords(a);
  const y = nameWords(b);
  return !!(x.length && y.length && x[0] === y[0]);
}

/** Same-company check before attaching a token to an existing ticker. */
function priceAgrees(item, priceUsd) {
  const ref = Number(item.fairPrice) > 0 ? Number(item.fairPrice) : Number(item.price);
  const p = Number(priceUsd);
  if (!(ref > 0) || !(p > 0)) return true;
  const ratio = p / ref;
  return ratio > 0.75 && ratio < 1.33;
}

/**
 * Merge catalog + classified LI.FI tokens into one item per ticker.
 * Catalog fields are preserved so the legacy trade engine keeps working.
 */
export function buildStocksUniverse({ catalog = [], lifiTokens = {} } = {}) {
  const bySym = new Map();
  const byTokenSym = new Map();
  for (const it of Array.isArray(catalog) ? catalog : []) {
    const sym = String(it?.sym || '').toUpperCase();
    if (!sym || bySym.has(sym)) continue;
    const item = {
      ...it,
      sym,
      name: cleanStockName(it.name) || sym,
      variants: [],
      src: 'catalog',
    };
    const dec = Number(it.decimals) || 18;
    for (const [cidRaw, addr] of Object.entries(it.addrs || {})) {
      const cid = Number(cidRaw);
      if (!STOCK_CHAINS[cid] || !EVM_ADDR.test(String(addr || ''))) continue;
      item.variants.push({ k: 'x', s: it.tokenSym, c: cid, a: addr, d: dec });
    }
    if (SOL_MINT.test(String(it.solMint || ''))) {
      item.variants.push({ k: 'x', s: it.tokenSym, c: 'solana', a: it.solMint, d: Number(it.solDecimals) || 8 });
    }
    bySym.set(sym, item);
    if (it.tokenSym) byTokenSym.set(String(it.tokenSym).toLowerCase(), item);
  }
  for (const [cidRaw, list] of Object.entries(lifiTokens || {})) {
    for (const token of Array.isArray(list) ? list : []) {
      const t = classifyLifiStockToken(token, cidRaw);
      if (!t) continue;
      const v = { k: t.kind, s: t.symbol, c: t.chainId, a: t.address, d: t.decimals, p: t.priceUsd };
      let item;
      if (t.kind === 'x') {
        item = byTokenSym.get(t.symbol.toLowerCase());
        if (!item) continue; // unknown xStock outside the canonical catalog
      } else {
        item = bySym.get(t.ticker);
        if (item && !priceAgrees(item, t.priceUsd) && !namesAgree(item.name, t.name)) continue; // same ticker, different company
        if (!item) {
          item = {
            sym: t.ticker,
            yahooSym: t.ticker.replace(/\./g, '-'),
            tokenSym: '',
            name: t.name || t.ticker,
            logo: t.logo,
            addrs: {},
            chains: [],
            solMint: '',
            solDecimals: 8,
            decimals: 18,
            tradeable: true,
            halted: false,
            price: t.priceUsd || 0,
            fairPrice: 0,
            chg: null,
            vol24: '—',
            mc: '—',
            variants: [],
            src: 'lifi',
          };
          bySym.set(t.ticker, item);
        }
        if (!item.logo && t.logo) item.logo = t.logo;
        if (!(Number(item.price) > 0) && t.priceUsd) item.price = t.priceUsd;
      }
      if (!item.variants.some((x) => variantKey(x) === variantKey(v))) item.variants.push(v);
    }
  }
  const out = [];
  for (const item of bySym.values()) {
    if (!item.variants.length) continue;
    item.k = stockCategory(item.sym, item.name);
    out.push(item);
  }
  return out;
}

/** Compact list row for the Stocks list (no addresses). */
/** Listings quoted outside the US (e.g. 0700.HK): Yahoo cap/turnover are in local currency, not USD. */
export function isNonUsdListing(item) {
  return /\.[A-Z]{1,3}$/.test(String(item?.yahooSym || ''));
}

export function compactStockRow(item) {
  const nets = [...new Set(item.variants.map((v) => (v.c === 'solana' ? 'solana' : STOCK_CHAINS[v.c]?.key)).filter(Boolean))];
  const kinds = [...new Set(item.variants.map((v) => v.k))];
  const num = (x) => (Number.isFinite(Number(x)) && Number(x) !== 0 ? Number(x) : null);
  const foreign = isNonUsdListing(item);
  return {
    s: item.sym,
    n: item.name,
    l: item.src === 'lifi' ? (item.logo || '') : '',
    p: num(item.price),
    f: num(item.fairPrice),
    c: item.chg == null || !Number.isFinite(Number(item.chg)) ? null : Number(item.chg),
    ca: num(item.chgAbs),
    mc: foreign ? null : (item.mcNum || parseCompactUsd(item.mc)),
    v: foreign ? null : (item.volNum || parseCompactUsd(item.vol24)),
    pe: num(item.pe),
    k: item.k || null,
    h: item.halted ? 1 : 0,
    nets,
    kinds,
  };
}

/** Public detail payload (addresses included, no internal fields). */
export function detailStockPayload(item) {
  return {
    ...compactStockRow(item),
    yahooSym: item.yahooSym || null,
    tokenSym: item.tokenSym || '',
    solMint: item.solMint || '',
    solDecimals: Number(item.solDecimals) || 8,
    decimals: Number(item.decimals) || 18,
    addrs: item.addrs || {},
    variants: item.variants.map((v) => ({
      k: v.k,
      s: v.s,
      c: v.c,
      net: v.c === 'solana' ? 'solana' : STOCK_CHAINS[v.c]?.key,
      a: v.a,
      d: v.d,
      p: v.p ?? null,
    })),
  };
}

const QUOTE_SIDE = new Set(['USDC', 'USDT', 'USDG', 'USD1', 'PYUSD', 'USDE', 'DAI', 'USDS', 'FDUSD', 'USDC.E', 'USDT0', 'JUPUSD',
  'ETH', 'WETH', 'SOL', 'WSOL', 'BNB', 'WBNB', 'HYPE', 'WHYPE', 'MON', 'WMON', 'USDBC', 'CBBTC', 'WBTC']);

/** Sum pool liquidity for one token from DexScreener token-pairs rows. */
export function sumTokenLiquidity(pairs, address, knownStockAddrs = new Set()) {
  const solana = SOL_MINT.test(address) && !EVM_ADDR.test(address);
  const norm = (a) => (solana ? String(a || '') : String(a || '').toLowerCase());
  const me = norm(address);
  let liq = 0;
  let vol = 0;
  let pools = 0;
  for (const p of Array.isArray(pairs) ? pairs : []) {
    const base = p?.baseToken || {};
    const quote = p?.quoteToken || {};
    const isBase = norm(base.address) === me;
    const isQuote = norm(quote.address) === me;
    if (!isBase && !isQuote) continue;
    const other = isBase ? quote : base;
    const otherSym = String(other.symbol || '').toUpperCase();
    const otherIsStock = knownStockAddrs.has(norm(other.address)) || knownStockAddrs.has(String(other.address || '').toLowerCase());
    if (!QUOTE_SIDE.has(otherSym) && !otherIsStock) continue;
    const l = Number(p?.liquidity?.usd);
    const v = Number(p?.volume?.h24);
    if (Number.isFinite(l) && l > 0) liq += l;
    if (Number.isFinite(v) && v > 0) vol += v;
    pools += 1;
  }
  return { liq: Math.round(liq), vol: Math.round(vol), pools };
}

function boundedCache(max) {
  const map = new Map();
  return {
    get(key, ttl, now) {
      const hit = map.get(key);
      if (!hit) return null;
      if (now - hit.ts >= ttl) { map.delete(key); return null; }
      return hit.value;
    },
    set(key, value, now) {
      map.delete(key);
      while (map.size >= max) map.delete(map.keys().next().value);
      map.set(key, { ts: now, value });
    },
  };
}

/**
 * Universe loader: catalog + LI.FI lists + Yahoo metrics for the extra tickers.
 * Every dependency is injectable for tests.
 */
export function createStocksUniverse({
  getCatalog,
  fetchLifiTokens,
  fetchMetrics,
  now = Date.now,
  lifiTtlMs = 6 * 60 * 60_000,
  metricsTtlMs = 10 * 60_000,
  coldLifiWaitMs = 6000,
} = {}) {
  if (typeof getCatalog !== 'function' || typeof fetchLifiTokens !== 'function') {
    throw new TypeError('getCatalog and fetchLifiTokens are required');
  }
  let lifi = { ts: 0, data: null };
  let lifiPending = null;
  let extraMetrics = new Map();
  let metricsTs = 0;
  let metricsPending = null;
  let built = { key: null, catalog: null, items: [] };

  function loadLifi() {
    if (!lifiPending) {
      lifiPending = Promise.resolve().then(fetchLifiTokens).then((data) => {
        if (data && typeof data === 'object' && Object.keys(data).length) lifi = { ts: now(), data };
        return lifi.data;
      }).catch(() => lifi.data).finally(() => { lifiPending = null; });
    }
    return lifiPending;
  }

  function refreshExtraMetrics(items) {
    if (typeof fetchMetrics !== 'function' || metricsPending) return;
    if (now() - metricsTs < metricsTtlMs && extraMetrics.size) return;
    const extras = items.filter((it) => it.src === 'lifi');
    if (!extras.length) return;
    metricsPending = Promise.resolve()
      .then(() => fetchMetrics(extras.map((it) => ({ sym: it.sym, yahooSym: it.yahooSym }))))
      .then((map) => {
        if (map && map.size) { extraMetrics = map; metricsTs = now(); built.key = null; }
      })
      .catch(() => {})
      .finally(() => { metricsPending = null; });
  }

  async function get() {
    const catalog = await getCatalog().catch(() => []);
    if (!lifi.data) {
      await Promise.race([loadLifi(), new Promise((r) => setTimeout(r, coldLifiWaitMs))]);
    } else if (now() - lifi.ts > lifiTtlMs) {
      void loadLifi();
    }
    /* Rebuild whenever the catalog array is replaced (background price/metrics refresh). */
    const key = `${lifi.ts}|${metricsTs}`;
    if (built.key === key && built.catalog === catalog && built.items.length) return built.items;
    const items = buildStocksUniverse({ catalog, lifiTokens: lifi.data || {} });
    for (const it of items) {
      if (it.src !== 'lifi') continue;
      const m = extraMetrics.get(it.sym);
      if (!m) continue;
      if (m.equityPx > 0 && m.currency === 'USD') { it.fairPrice = m.equityPx; it.fairPriceAt = metricsTs; }
      if (m.chg != null) it.chg = m.chg;
      if (m.chgAbs != null) it.chgAbs = m.chgAbs;
      if (m.mc && m.mc !== '—') it.mc = m.mc;
      if (m.mcNum) it.mcNum = m.mcNum;
      if (m.vol24 && m.vol24 !== '—') it.vol24 = m.vol24;
      if (m.pe) it.pe = m.pe;
    }
    built = { key, catalog, items };
    refreshExtraMetrics(items);
    return items;
  }

  return {
    get,
    async find(sym) {
      const s = String(sym || '').trim().toUpperCase();
      if (!s || s.length > 16) return null;
      const items = await get();
      return items.find((it) => it.sym === s) || null;
    },
    /** Rows for the chart proxy: sym + yahooSym of every universe ticker. */
    async chartCatalog() {
      return (await get()).map((it) => ({ sym: it.sym, yahooSym: it.yahooSym || it.sym.replace(/\./g, '-') }));
    },
  };
}

/** Per-ticker on-chain liquidity across every variant (DexScreener), cached and bounded. */
export function createStockLiquidity({ fetchPairs, now = Date.now, ttlMs = 20 * 60_000, maxPerMinute = 200, concurrency = 4 } = {}) {
  if (typeof fetchPairs !== 'function') throw new TypeError('fetchPairs is required');
  const cache = boundedCache(600);
  const inflight = new Map();
  let windowStart = 0;
  let used = 0;
  function budget(n, background) {
    const t = now();
    if (t - windowStart >= 60_000) { windowStart = t; used = 0; }
    /* Background pre-warming may use only half the budget — visitors always keep headroom. */
    const cap = background ? Math.floor(maxPerMinute / 2) : maxPerMinute;
    if (used + n > cap) return false;
    used += n;
    return true;
  }
  async function forItem(item, knownStockAddrs, { background = false } = {}) {
    const key = item.sym;
    const hit = cache.get(key, ttlMs, now());
    if (hit) return hit;
    if (inflight.has(key)) return inflight.get(key);
    const jobs = item.variants.filter((v) => (v.c === 'solana' ? STOCK_CHAINS.solana : STOCK_CHAINS[v.c])?.ds);
    if (!budget(jobs.length, background)) return null;
    const pending = (async () => {
      const out = {};
      for (let i = 0; i < jobs.length; i += concurrency) {
        await Promise.all(jobs.slice(i, i + concurrency).map(async (v) => {
          const ds = (v.c === 'solana' ? STOCK_CHAINS.solana : STOCK_CHAINS[v.c]).ds;
          try {
            const pairs = await fetchPairs(ds, v.a);
            out[variantKey(v)] = sumTokenLiquidity(pairs, v.a, knownStockAddrs);
          } catch (_) {
            out[variantKey(v)] = null;
          }
        }));
      }
      cache.set(key, out, now());
      return out;
    })();
    inflight.set(key, pending);
    try { return await pending; } finally { inflight.delete(key); }
  }
  /** Cached result only — never starts upstream requests. */
  function peek(sym) { return cache.get(String(sym || ''), ttlMs, now()); }
  return { forItem, peek, variantKey };
}

/** Company logo from the public logo host (PNG). Returns null when there is no logo. */
export async function fetchStockLogoFmp(sym) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const url = 'https://financialmodelingprep.com/image-stock/' + encodeURIComponent(String(sym).replace(/\./g, '-')) + '.png';
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: 'image/*' } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('logo_http_' + r.status);
    const type = String(r.headers.get('content-type') || '');
    if (!/^image\//i.test(type)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length || buf.length > 400_000) return null;
    return { buf, type };
  } finally {
    clearTimeout(t);
  }
}

/** Register /stocks, /stocks/detail, /stocks/spark, /stocks/indices, /stocks/logo/:sym and /stocks/tokens on the market router. */
export function registerStocksRoutes(router, {
  universe,
  liquidity,
  fetchReference,
  fetchSpark,
  fetchIndices,
  fetchLogo = fetchStockLogoFmp,
} = {}) {
  if (!universe || !liquidity) throw new TypeError('universe and liquidity are required');
  const limiter = (max) => rateLimit({
    windowMs: 60_000, max, standardHeaders: true, legacyHeaders: false,
    validate: { trustProxy: false }, message: { error: 'rate_limited' },
  });
  let knownAddrs = { ts: 0, set: new Set() };
  const stockAddrSet = async () => {
    if (Date.now() - knownAddrs.ts < 10 * 60_000 && knownAddrs.set.size) return knownAddrs.set;
    const set = new Set();
    for (const it of await universe.get()) {
      for (const v of it.variants) set.add(v.c === 'solana' ? v.a : String(v.a).toLowerCase());
    }
    knownAddrs = { ts: Date.now(), set };
    return set;
  };

  router.get('/stocks', limiter(60), async (_req, res) => {
    try {
      const items = await universe.get();
      if (!items.length) return res.status(503).json({ items: [], error: 'stocks_unavailable' });
      const networks = Object.fromEntries(Object.entries(STOCK_CHAINS).map(([id, c]) => [c.key, { id: id === 'solana' ? 'solana' : Number(id), name: c.name }]));
      return res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120')
        .json({ items: items.map(compactStockRow), networks, count: items.length, ts: Date.now() });
    } catch (_) {
      return res.status(502).json({ items: [], error: 'stocks_unavailable' });
    }
  });

  /* Small payload for the home page: largest US-listed companies with today's move. */
  router.get('/stocks/top', limiter(60), async (req, res) => {
    try {
      const n = Math.max(1, Math.min(24, Number.parseInt(req.query?.n, 10) || 12));
      const items = await universe.get();
      if (!items.length) return res.status(503).json({ items: [], error: 'stocks_unavailable' });
      const top = items.map(compactStockRow)
        .filter((r) => r.mc > 0 && r.p > 0 && Number.isFinite(r.c))
        .sort((a, b) => b.mc - a.mc)
        .slice(0, n)
        .map((r) => ({ s: r.s, n: r.n, p: r.p, c: r.c, mc: r.mc }));
      return res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120')
        .json({ items: top, count: items.length, ts: Date.now() });
    } catch (_) {
      return res.status(502).json({ items: [], error: 'stocks_unavailable' });
    }
  });

  router.get('/stocks/detail', limiter(40), async (req, res) => {
    try {
      const item = await universe.find(req.query?.sym || req.query?.symbol);
      if (!item) return res.status(404).json({ error: 'unknown_stock' });
      /* Never block the page on DexScreener: answer from cache, fill it in the background. */
      let liqMap = typeof liquidity.peek === 'function' ? liquidity.peek(item.sym) : null;
      const pendingLiq = !liqMap;
      if (pendingLiq) {
        const addrs = await stockAddrSet();
        const job = liquidity.forItem(item, addrs).catch(() => null);
        /* Short wait covers warm upstreams; slower lookups finish after the response. */
        liqMap = await Promise.race([job, new Promise((r) => setTimeout(() => r(null), 900))]);
      }
      const ref = typeof fetchReference === 'function' ? await fetchReference(item).catch(() => null) : null;
      const payload = detailStockPayload(item);
      if (liqMap) {
        for (const v of payload.variants) {
          const l = liqMap[variantKey(v)];
          if (l) { v.liq = l.liq; v.vol = l.vol; v.pools = l.pools; }
        }
      }
      payload.liquidityKnown = !!liqMap;
      payload.ref = ref || null;
      return res.set('Cache-Control', liqMap ? 'public, max-age=30' : 'no-store').json(payload);
    } catch (_) {
      return res.status(502).json({ error: 'stock_unavailable' });
    }
  });

  router.get('/stocks/spark', limiter(30), async (req, res) => {
    try {
      if (typeof fetchSpark !== 'function') return res.json({ series: {} });
      const want = String(req.query?.syms || '').toUpperCase().split(',').map((s) => s.trim()).filter(Boolean).slice(0, 30);
      if (!want.length) return res.json({ series: {} });
      const items = await universe.get();
      const bySym = new Map(items.map((it) => [it.sym, it]));
      const rows = want.map((s) => bySym.get(s)).filter(Boolean).map((it) => ({ sym: it.sym, yahooSym: it.yahooSym || it.sym.replace(/\./g, '-') }));
      const series = rows.length ? await fetchSpark(rows) : {};
      return res.set('Cache-Control', 'public, max-age=300').json({ series });
    } catch (_) {
      return res.json({ series: {} });
    }
  });

  /* Stock logos through our own domain (2026-11-14): the logo host sends no Cache-Control,
   * so phones re-checked every logo on every visit and lists showed blank tiles first.
   * Only tickers from the stocks list are served (no open proxy). */
  const LOGO_TTL = 7 * 24 * 3600_000;
  const LOGO_MISS_TTL = 6 * 3600_000;
  const LOGO_ERR_TTL = 5 * 60_000;
  const LOGO_MAX = 3000;
  const logoCache = new Map();
  const logoInflight = new Map();
  let knownSyms = { ts: 0, set: new Set() };
  const stockSymSet = async () => {
    if (Date.now() - knownSyms.ts < 10 * 60_000 && knownSyms.set.size) return knownSyms.set;
    const set = new Set((await universe.get()).map((it) => String(it.sym || '').toUpperCase()));
    knownSyms = { ts: Date.now(), set };
    return set;
  };
  const loadLogo = (sym) => {
    if (logoInflight.has(sym)) return logoInflight.get(sym);
    const p = (async () => {
      let hit;
      try {
        const got = await fetchLogo(sym);
        hit = got && got.buf && got.buf.length ? { buf: got.buf, type: got.type || 'image/png', at: Date.now() } : { miss: true, at: Date.now(), ttl: LOGO_MISS_TTL };
      } catch (_) {
        hit = { miss: true, at: Date.now(), ttl: LOGO_ERR_TTL };
      }
      if (logoCache.size >= LOGO_MAX) logoCache.delete(logoCache.keys().next().value);
      logoCache.set(sym, hit);
      return hit;
    })();
    logoInflight.set(sym, p);
    return p.finally(() => logoInflight.delete(sym));
  };
  router.get('/stocks/logo/:sym', limiter(1200), async (req, res) => {
    const sym = String(req.params.sym || '').replace(/\.png$/i, '').toUpperCase();
    if (!TICKER.test(sym)) return res.status(400).set('Cache-Control', 'public, max-age=3600').end();
    try {
      if (!(await stockSymSet()).has(sym)) return res.status(404).set('Cache-Control', 'public, max-age=3600').end();
      let hit = logoCache.get(sym);
      if (!hit || Date.now() - hit.at > (hit.miss ? hit.ttl : LOGO_TTL)) hit = await loadLogo(sym);
      if (hit.miss) return res.status(404).set('Cache-Control', 'public, max-age=' + Math.round(hit.ttl / 1000)).end();
      return res.set('Content-Type', hit.type)
        .set('Cache-Control', 'public, max-age=604800, stale-while-revalidate=2592000')
        .set('Access-Control-Allow-Origin', '*')
        .send(hit.buf);
    } catch (_) {
      return res.status(502).set('Cache-Control', 'no-store').end();
    }
  });

  /* Which token contracts are tokenized stocks / ETFs — lets the swap token list tag them.
   * Short keys: "<chainId>:<first 12 hex of the address>" (Solana: "sol:<first 12 chars>"). */
  let tokenTags = { ts: 0, body: null };
  router.get('/stocks/tokens', limiter(30), async (_req, res) => {
    try {
      if (!tokenTags.body || Date.now() - tokenTags.ts > 10 * 60_000) {
        const etf = [];
        const stock = [];
        for (const it of await universe.get()) {
          const out = it.k === 'etf' ? etf : stock;
          for (const v of it.variants) {
            const a = String(v.a || '');
            if (v.c === 'solana') { if (a) out.push('sol:' + a.slice(0, 12)); continue; }
            if (EVM_ADDR.test(a)) out.push(Number(v.c) + ':' + a.slice(2, 14).toLowerCase());
          }
        }
        tokenTags = { ts: Date.now(), body: { v: 1, etf: [...new Set(etf)], stock: [...new Set(stock)] } };
      }
      return res.set('Cache-Control', 'public, max-age=21600, stale-while-revalidate=86400').json(tokenTags.body);
    } catch (_) {
      return res.status(502).json({ v: 1, etf: [], stock: [] });
    }
  });

  router.get('/stocks/indices', limiter(30), async (_req, res) => {
    try {
      if (typeof fetchIndices !== 'function') return res.json({ indices: [] });
      const data = await fetchIndices();
      return res.set('Cache-Control', 'public, max-age=60').json(data || { indices: [] });
    } catch (_) {
      return res.json({ indices: [] });
    }
  });
  return router;
}
