import express from 'express';
import axios from 'axios';
import fs from 'fs';
import config from '../config/index.js';
import { isCurrentPmEnd } from './predict-freshness.js';
import { registerXstocksChartRoute } from './xstocks-chart.js';

const CG_IDS = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin', XRP: 'ripple',
  ADA: 'cardano', DOGE: 'dogecoin', AVAX: 'avalanche-2', LINK: 'chainlink',
TRX: 'tron', DOT: 'polkadot', ATOM: 'cosmos',
  NEAR: 'near', LTC: 'litecoin', BCH: 'bitcoin-cash', SUI: 'sui',
  PEPE: 'pepe', SHIB: 'shiba-inu', APT: 'aptos', UNI: 'uniswap',
  ETC: 'ethereum-classic', ICP: 'internet-computer', ARB: 'arbitrum', OP: 'optimism',
  SUN: 'sun-token',
};

function fallbackQuotes() {
  return {
    cryptoChange24h: {},
    crypto: {
      BTC: 104218.4, ETH: 3684.15, SOL: 182.27, BNB: 612.88, XRP: 2.48, ADA: 0.752, DOGE: 0.1942,
      AVAX: 38.44, LINK: 17.28, TRX: 0.1462, DOT: 7.11, ATOM: 8.54, NEAR: 6.37, LTC: 96.42,
      BCH: 522.18, SUI: 1.84, PEPE: 0.0000124, SHIB: 0.0000246, APT: 9.87, UNI: 11.42, ETC: 31.75,
      ICP: 14.33, ARB: 1.06, OP: 2.91, SUN: 0.0165,
    },
    fx: { EURUSD: 1.0842, GBPJPY: 193.482, USDJPY: 151.12 },
    equities: { AAPL: 206.8, TSLA: 173.4, MSFT: 417.2, NVDA: 922.4 },
  };
}

/** Quotes used to await CoinGecko + FX + Stooq serially (~5–15s). Cache + parallel. */
let _quotesCache = { ts: 0, data: null };
let _quotesRefreshPromise = null;
const QUOTES_TTL_MS = 30_000;
const QUOTES_STALE_MS = 10 * 60_000;

// ---- Polymarket prediction-markets proxy (public, cached) ----
/** Per-locale browse catalogs (Polymarket `locale=`). */
const _predictCacheByLocale = new Map(); // locale → { ts, data, meta, refreshing }
const _predictSearchCache = new Map(); // key → { ts, payload }
const PREDICT_TTL = 90_000; // fresh window — keep odds close to Polymarket
const PREDICT_STALE_TTL = 20 * 60_000; // serve stale while revalidating
const PREDICT_SEARCH_TTL = 30_000;
/** Locales Polymarket Gamma accepts (probe 2026-08). Others fall back to en. */
const PM_LOCALES = new Set(['en', 'es', 'zh', 'ru', 'hi', 'tr', 'pt', 'fr', 'de']);
function pmLocale(raw) {
  const l = String(raw || 'en').trim().toLowerCase().split(/[-_]/)[0];
  if (!l || l === 'ar') return 'en'; // Arabic unsupported on Gamma → English titles
  return PM_LOCALES.has(l) ? l : 'en';
}
/** Browse catalog — quick volume pages first, then expand via tags. */
const PREDICT_MAX_EVENTS = 2500;
const PREDICT_MAX_OUTCOMES = 12;
const PREDICT_PAGE = 100;
const PREDICT_VOLUME_PAGES_QUICK = 6; // ~600 events, cold path ~1–2s
const PREDICT_VOLUME_PAGES_FULL = 10;
const PREDICT_TAG_PAGES = 3;
const PREDICT_FETCH_CONCURRENCY = 6;
const PREDICT_TAG_SLUGS = [
  // Sports leagues first so «Спорт» fills quickly
  'mlb', 'nba', 'nfl', 'soccer', 'tennis', 'ufc', 'hockey', 'cricket', 'baseball', 'basketball',
  'politics', 'crypto', 'esports', 'finance', 'pop-culture', 'tech', 'ai',
];
const PREDICT_DEFAULT_LIMIT = 60;
const PREDICT_MAX_LIMIT = 120;
const PM_UA = { Accept: 'application/json', 'User-Agent': 'grom-exchange/1.0' };

// ---- Backed xStocks catalog proxy (public, cached) — browser can't call api.backed.fi (no CORS) ----
let _xstocksCache = { ts: 0, data: null };
let _xstocksRefreshPromise = null;
let _xstocksEnrichPromise = null;
const XSTOCKS_TTL = 5 * 60_000;
const XSTOCKS_DISK = '/tmp/grom-xstocks-cache.json';
const GWX_NET = {
  Ethereum: 1, Arbitrum: 42161, Optimism: 10, BinanceSmartChain: 56,
  Base: 8453, Polygon: 137, Avalanche: 43114, Mantle: 5000,
};

function loadXstocksDiskCache() {
  try {
    if (!fs.existsSync(XSTOCKS_DISK)) return;
    const raw = JSON.parse(fs.readFileSync(XSTOCKS_DISK, 'utf8'));
    const items = Array.isArray(raw?.items) ? raw.items : null;
    const ts = Number(raw?.ts) || 0;
    if (items?.length >= 40) _xstocksCache = { ts: ts || Date.now(), data: items };
  } catch (_) {}
}
function saveXstocksDiskCache(items) {
  try {
    fs.writeFileSync(XSTOCKS_DISK, JSON.stringify({ ts: Date.now(), items }), 'utf8');
  } catch (_) {}
}
loadXstocksDiskCache();

function xstocksMetricsMostlyBlank(items) {
  const sample = (items || []).slice(0, 50);
  if (!sample.length) return true;
  let blank = 0;
  for (const it of sample) {
    if (!it?.vol24 || it.vol24 === '—' || !it?.mc || it.mc === '—') blank += 1;
  }
  return blank >= Math.ceil(sample.length * 0.6);
}

function scheduleXstocksEnrich(items) {
  if (!items?.length || _xstocksEnrichPromise) return;
  const snap = items;
  _xstocksEnrichPromise = (async () => {
    try {
      const copy = snap.map((it) => ({ ...it, addrs: { ...(it.addrs || {}) }, chains: (it.chains || []).slice() }));
      await enrichXstocksMetrics(copy);
      if (copy.length) {
        _xstocksCache = { ts: Date.now(), data: copy };
        saveXstocksDiskCache(copy);
      }
    } catch (_) {}
    finally { _xstocksEnrichPromise = null; }
  })();
}
/* Disk cache from before vol/mc restore may be all "—" — re-enrich on boot. */
try {
  if (_xstocksCache.data?.length && xstocksMetricsMostlyBlank(_xstocksCache.data)) {
    scheduleXstocksEnrich(_xstocksCache.data);
  }
} catch (_) {}

async function fetchBackedXstocksCatalog() {
  const all = [];
  for (let page = 0; page < 24; page++) {
    const { data } = await axios.get('https://api.backed.fi/api/v2/public/assets', {
      params: { page },
      timeout: 12000,
      headers: { Accept: 'application/json', 'User-Agent': 'grom-exchange/1.0' },
    });
    const nodes = Array.isArray(data?.nodes) ? data.nodes : [];
    all.push(...nodes);
    if (!data?.page?.hasNextPage) break;
  }
  const seen = new Set();
  const items = [];
  for (const n of all) {
    const name = String(n?.name || '');
    const tokenSym = String(n?.symbol || '');
    if (!/xStock$/i.test(name)) continue;
    if (!/x$/i.test(tokenSym)) continue;
    const rawUnd = String(n.underlyingSymbol || '').trim();
    // HKEX codes are numeric ("1", "1024") — don't use those as the UI ticker.
    const displaySym = (/^\d+$/.test(rawUnd)
      ? tokenSym.replace(/x$/i, '')
      : (rawUnd || tokenSym.replace(/x$/i, ''))).toUpperCase();
    if (!displaySym || seen.has(displaySym)) continue;
    const addrs = {};
    const chains = [];
    let solMint = '';
    for (const dep of (n.deployments || [])) {
      const addr = dep.address || dep.wrapperAddressV2 || dep.wrapperAddress;
      if (!addr) continue;
      // Solana SPL mint (base58) — primary DEX liquidity for xStocks
      if (String(dep.network) === 'Solana' && !/^0x/i.test(addr) && addr.length >= 32) {
        solMint = String(addr);
        continue;
      }
      const cid = GWX_NET[dep.network];
      if (!cid || !/^0x[a-fA-F0-9]{40}$/i.test(addr)) continue;
      addrs[cid] = addr;
      chains.push(cid);
    }
    // Prefer EVM for UI chain chips; Solana mint kept separately for Jupiter / LiFi bridge
    if (!chains.length && !solMint) continue;
    seen.add(displaySym);
    const pref = [1, 42161, 10, 56, 8453].find((c) => addrs[c]) || chains[0] || null;
    items.push({
      sym: displaySym,
      yahooSym: toYahooSymbol(rawUnd || displaySym, n.underlyingIsin),
      tokenSym,
      name,
      logo: n.logo || '',
      addrs,
      chains,
      solMint,
      solDecimals: 8,
      chain: pref || 'solana',
      chainLabel: pref
        ? (Object.keys(GWX_NET).find((k) => GWX_NET[k] === pref) || String(pref))
        : 'Solana',
      decimals: 18,
      tradeable: true,
      halted: !!n.isTradingHalted,
      price: 0,
      chg: null,
      chgSource: null,
      vol24: '—',
      mc: '—',
    });
  }
  items.sort((a, b) => String(a.tokenSym || a.sym).localeCompare(String(b.tokenSym || b.sym)));
  // Routes first — Yahoo/Dex enrich runs in background so cold /xstocks is not 30–60s.
  scheduleXstocksEnrich(items);
  return items;
}

// Yahoo Finance session (crumb + cookie) for equity volume / market cap.
let _yfSession = { crumb: '', cookie: '', ts: 0 };
const YF_UA = 'Mozilla/5.0 (compatible; GROMExchange/1.0; +https://grom.exchange)';

function fmtCompactUsd(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return '—';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function toYahooSymbol(sym, isin) {
  const s = String(sym || '').toUpperCase().trim();
  // HKEX numeric codes (0001 CK Hutchison, 1024 Kuaishou, …)
  if (/^\d+$/.test(s)) return s.padStart(4, '0') + '.HK';
  const isinS = String(isin || '').toUpperCase();
  if (/^\d+$/.test(s.replace(/^0+/, '') || s) && (isinS.startsWith('HK') || isinS.startsWith('KYG') || isinS.startsWith('CNE'))) {
    return s.replace(/\D/g, '').padStart(4, '0') + '.HK';
  }
  // BRK.B → BRK-B
  return s.replace(/\./g, '-');
}

async function ensureYahooSession() {
  if (_yfSession.crumb && Date.now() - _yfSession.ts < 45 * 60_000) return _yfSession;
  const warm = await axios.get('https://fc.yahoo.com', {
    timeout: 8000,
    maxRedirects: 5,
    validateStatus: () => true,
    headers: { 'User-Agent': YF_UA, Accept: 'text/html' },
  });
  const cookie = []
    .concat(warm.headers['set-cookie'] || [])
    .map((c) => String(c).split(';')[0])
    .filter(Boolean)
    .join('; ');
  const crumbRes = await axios.get('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    timeout: 8000,
    responseType: 'text',
    headers: { 'User-Agent': YF_UA, Cookie: cookie, Accept: 'text/plain' },
  });
  const crumb = String(crumbRes.data || '').trim();
  if (!crumb || /error|html|<!/i.test(crumb)) throw new Error('yahoo crumb unavailable');
  _yfSession = { crumb, cookie, ts: Date.now() };
  return _yfSession;
}

/** Batch Yahoo quotes → Map(item.sym → { vol24, mc, equityPx, chg }) */
async function fetchYahooEquityMetrics(items) {
  const rows = (items || []).map((it) => ({
    key: String(it?.sym || '').toUpperCase(),
    ysym: String(it?.yahooSym || toYahooSymbol(it?.sym, it?.underlyingIsin)).toUpperCase(),
  })).filter((r) => r.key && r.ysym);
  const out = new Map();
  if (!rows.length) return out;
  let session;
  try { session = await ensureYahooSession(); } catch (_) { return out; }

  const chunkSize = 80;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const ysyms = chunk.map((r) => r.ysym);
    try {
      const { data } = await axios.get('https://query1.finance.yahoo.com/v7/finance/quote', {
        timeout: 12000,
        params: { symbols: ysyms.join(','), crumb: session.crumb },
        headers: { 'User-Agent': YF_UA, Cookie: session.cookie, Accept: 'application/json' },
      });
      const quotes = data?.quoteResponse?.result || [];
      const byY = new Map(quotes.map((r) => [String(r.symbol || '').toUpperCase(), r]));
      for (const row of chunk) {
        const r = byY.get(row.ysym);
        if (!r) continue;
        const px = Number(r.regularMarketPrice);
        const shares = Number(r.regularMarketVolume);
        const mc = Number(r.marketCap);
        const rawChg = r.regularMarketChangePercent;
        const chg = rawChg == null ? null : Number(rawChg);
        const dollarVol = (Number.isFinite(px) && Number.isFinite(shares) && px > 0 && shares > 0)
          ? px * shares
          : 0;
        out.set(row.key, {
          vol24: fmtCompactUsd(dollarVol),
          mc: fmtCompactUsd(mc),
          equityPx: Number.isFinite(px) && px > 0 ? px : 0,
          chg: Number.isFinite(chg) ? chg : null,
          chgSource: Number.isFinite(chg) ? 'yahoo' : null,
        });
      }
    } catch (e) {
      if (String(e?.response?.status || '') === '401' || String(e?.response?.status || '') === '403') {
        _yfSession = { crumb: '', cookie: '', ts: 0 };
        try {
          session = await ensureYahooSession();
          i -= chunkSize;
          continue;
        } catch (_) { break; }
      }
    }
  }
  return out;
}

/** Live xStock *token* mids + 24h pool volume from DexScreener (Solana).
 *  Never use Yahoo equity price here — post-split names (NFLX 10:1) diverge. */
async function fetchDexScreenerTokenPrices(items) {
  if (!Array.isArray(items) || !items.length) return items;
  const mints = [...new Set(items.map((it) => String(it.solMint || '')).filter((m) => m.length >= 32))];
  if (!mints.length) return items;
  const byMint = new Map();
  const chunkSize = 25;
  const chunks = [];
  for (let i = 0; i < mints.length; i += chunkSize) chunks.push(mints.slice(i, i + chunkSize));

  const runChunk = async (part) => {
    try {
      const { data } = await axios.get(
        `https://api.dexscreener.com/tokens/v1/solana/${part.join(',')}`,
        { timeout: 12000, headers: { Accept: 'application/json' } },
      );
      const pairs = Array.isArray(data) ? data : [];
      for (const p of pairs) {
        const mint = String(p?.baseToken?.address || '');
        const px = Number(p?.priceUsd);
        const liq = Number(p?.liquidity?.usd || 0);
        const vol = Number(p?.volume?.h24 || 0);
        if (!mint || !(px > 0)) continue;
        const prev = byMint.get(mint);
        if (!prev || liq > prev.liq) byMint.set(mint, { px, liq, vol });
      }
    } catch (_) { /* keep whatever we already have */ }
  };

  const conc = 4;
  for (let i = 0; i < chunks.length; i += conc) {
    await Promise.all(chunks.slice(i, i + conc).map(runChunk));
  }
  for (const it of items) {
    const hit = byMint.get(String(it.solMint || ''));
    if (hit?.px > 0) it.price = hit.px;
    if (hit?.vol > 0) it._dexVol24 = hit.vol;
  }
  return items;
}

async function enrichXstocksMetrics(items) {
  if (!Array.isArray(items) || !items.length) return items;
  const metrics = await fetchYahooEquityMetrics(items);
  if (metrics.size) {
    for (const it of items) {
      const m = metrics.get(String(it.sym || '').toUpperCase());
      if (!m) continue;
      if (m.chg != null) {
        it.chg = m.chg;
        it.chgSource = m.chgSource;
      }
      /* Market cap = underlying company (what «КАПИТАЛИЗАЦИЯ» means on Stocks). */
      if (m.mc && m.mc !== '—') it.mc = m.mc;
      /* Keep Yahoo equity $ volume as fallback; Dex pool vol preferred below. */
      if (m.vol24 && m.vol24 !== '—') it.vol24 = m.vol24;
    }
  }
  try { await fetchDexScreenerTokenPrices(items); } catch (_) {}
  for (const it of items) {
    /* Prefer on-chain 24h pool volume when DexScreener has it — honest token depth. */
    if (Number(it._dexVol24) > 0) {
      it.vol24 = fmtCompactUsd(it._dexVol24);
    }
    delete it._dexVol24;
  }
  // Dex mid wins (handles NFLX 10:1 vs unsplitted NFLXx). Yahoo equity only if no pool
  // and the quote is USD (skip *.HK — those prints are HKD).
  if (metrics.size) {
    for (const it of items) {
      if (Number(it.price) > 0) continue;
      if (/\.HK$/i.test(String(it.yahooSym || ''))) continue;
      const m = metrics.get(String(it.sym || '').toUpperCase());
      if (m?.equityPx > 0) it.price = m.equityPx;
    }
  }
  return items;
}

function safeJson(str, def) { try { return JSON.parse(str); } catch { return def; } }

/** Classify Polymarket events — tags are localized (en/ru/…), so match both. */
function pmCategory(ev) {
  const tags = (Array.isArray(ev.tags) ? ev.tags : [])
    .map((t) => String(t?.label || t?.slug || '').toLowerCase().trim())
    .filter(Boolean);
  const title = String(ev.title || ev.question || '').toLowerCase();
  const series = String(ev.seriesSlug || (Array.isArray(ev.series) && ev.series[0]?.slug) || '').toLowerCase();
  const hay = [String(ev.category || ''), title, series, ...tags].join(' ').toLowerCase();
  const has = (...ks) => ks.some((k) => k && hay.includes(String(k).toLowerCase()));
  const tagHas = (...ks) => tags.some((t) => ks.some((k) => {
    const n = String(k).toLowerCase();
    return t === n || t.includes(n);
  }));

  // Esports BEFORE sport — RU "киберспорт" contains "спорт"
  if (
    tagHas('esport', 'киберспорт', 'gaming', 'игры', 'games')
    || has(
      'esport', 'киберспорт', 'league of legends', 'лига легенд', 'lol:', 'dota', 'counter-strike',
      'cs2', 'cs:go', 'valorant', 'valorant:', 'overwatch', 'call of duty', 'mobile legends',
      'lck', 'lpl', 'lec', 'lcs', 'worlds', 'asgard', 'epl masters',
    )
  ) return 'esports';

  if (
    tagHas('crypto', 'крипто', 'bitcoin', 'биткоин', 'ethereum', 'эфириум')
    || has(
      'crypto', 'крипто', 'bitcoin', 'btc', 'биткоин', 'ethereum', 'eth', 'эфириум', 'solana', 'sol ',
      'memecoin', 'dogecoin', 'ripple', 'xrp', 'altcoin', 'defi', 'up or down', 'вверх или вниз',
    )
  ) return 'crypto';

  if (
    tagHas(
      'mlb', 'nba', 'nfl', 'nhl', 'soccer', 'футбол', 'tennis', 'теннис', 'ufc', 'hockey', 'хоккей',
      'cricket', 'baseball', 'basketball', 'баскетбол', 'sport', 'спорт',
    )
    || has(
      'nfl', 'nba', 'mlb', 'nhl', 'wnba', 'soccer', 'football', 'футбол', 'tennis', 'теннис',
      'baseball', 'бейсбол', 'basketball', 'баскетбол', 'hockey', 'хоккей', 'ufc', 'mma', 'f1',
      'golf', 'world cup', 'champions league', 'premier league', 'la liga', 'serie a', 'bundesliga',
      'olympic', 'олимпи', 'cricket', 'atp ', 'wta ', 'grand slam',
    )
  ) return 'sport';

  // Fed / macro → economy (even if also tagged Politics)
  if (
    tagHas('economy', 'экономи', 'fed', 'фрс', 'fomc', 'inflation', 'инфляц', 'gdp', 'cpi')
    || has(
      'fed decision', 'fed rate', 'fomc', 'rate cut', 'interest rate', 'inflation', 'инфляц',
      'cpi', 'gdp', 'recession', 'рецесс', 'jobs report', 'безработиц', 'econom', 'экономи',
      'фрс', 'ставк',
    )
  ) return 'economy';

  if (
    tagHas('finance', 'финанс', 'stock', 'акци', 'ipo', 'earnings', 'nasdaq', 'commodit', 'сырь')
    || has(
      'stock', 'акци', 'earnings', 'отчётн', 'nasdaq', 's&p', 'ipo', 'market cap', 'капитализац',
      'tesla', 'nvidia', 'apple', 'gold', 'золот', 'silver', 'серебр', 'oil', 'нефть', 'crude',
      'wti', 'commodit', 'финанс', 'finance',
    )
  ) return 'finance';

  if (
    tagHas('politic', 'политик', 'election', 'выбор', 'geopolit', 'геополит', 'iran', 'иран')
    || has(
      'politic', 'политик', 'election', 'выбор', 'president', 'президент', 'senate', 'сенат',
      'congress', 'конгресс', 'geopolit', 'геополит', 'trump', 'трамп', 'biden', 'байден',
      'iran', 'иран', 'war', 'войн', 'ceasefire', 'перемири', 'prime minister', 'премьер',
      'governor', 'губернатор', 'парламент', 'демократ', 'республик',
    )
  ) return 'politics';

  if (
    tagHas('culture', 'культур', 'entertainment', 'развлеч', 'movie', 'music', 'музык', 'ai', 'ии')
    || has(
      'culture', 'культур', 'movie', 'фильм', 'music', 'музык', 'tv ', 'celebrit', 'award',
      'oscar', 'оскар', 'grammy', 'грамми', 'entertain', 'развлеч', 'pop culture',
      'anthropic', 'openai', 'gemini', 'gpt-', 'claude', 'искусственн', 'ai model', 'ai lab',
      'ии-модел', 'модель ии',
    )
  ) return 'culture';

  // Weather / natural events stay in "all" (shown under Все)
  return 'all';
}
function pmEmoji(cat) {
  return { sport: '⚽', crypto: '🪙', esports: '🎮', politics: '🏛️', culture: '🎬', finance: '💹', economy: '📊' }[cat] || '🌐';
}
function pmDateLocale(locale = 'en') {
  const loc = pmLocale(locale);
  const map = {
    en: 'en-US', es: 'es-ES', zh: 'zh-CN', ru: 'ru-RU',
    hi: 'hi-IN', tr: 'tr-TR', pt: 'pt-BR', fr: 'fr-FR', de: 'de-DE',
  };
  return map[loc] || 'en-US';
}
function pmEnds(iso, locale = 'en') {
  if (!iso) return '';
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  try { return d.toLocaleDateString(pmDateLocale(locale), { day: 'numeric', month: 'short' }); } catch { return ''; }
}
function pmTime(iso, locale = 'en') {
  if (!iso) return '';
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  try { return d.toLocaleTimeString(pmDateLocale(locale), { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}
function pmEndsAt(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
/** Polymarket multi-date events often ship stub titles: "… by...?" / "… к...?" */
function isPmStubTitle(s) {
  const t = String(s || '').trim();
  if (!t) return true;
  // Any ellipsis in the title is treated as incomplete (incl. mid-phrase "к...? (…)")
  // Note: "___" blanks (Bitcoin above ___ on …) are intentional multi-strike titles — not stubs.
  if (/\.{2,}/.test(t) || /…/.test(t)) return true;
  return false;
}
function expandPmStubTitle(stub, fill) {
  if (!stub || !fill) return '';
  let expanded = String(stub)
    .replace(/\b(by)\s*\.{2,}\s*\??/gi, `by ${fill}`)
    .replace(/\b(к)\s*\.{2,}\s*\??/gi, `к ${fill}`)
    .replace(/\b(by)\s*…\s*\??/gi, `by ${fill}`)
    .replace(/\b(к)\s*…\s*\??/gi, `к ${fill}`)
    .replace(/\.{2,}\s*\??/g, fill)
    .replace(/…\s*\??/g, fill);
  expanded = expanded.replace(/\s+\?/g, '?').replace(/\?{2,}/g, '?').replace(/\s{2,}/g, ' ').trim();
  return (expanded && !isPmStubTitle(expanded)) ? expanded : '';
}
/**
 * Card title must match Polymarket's EVENT title for multi-outcome markets.
 * Never promote a single strike question (e.g. "…$70,000…") over
 * "What price will Bitcoin hit in August?" — that desyncs title vs rows.
 */
function pickPmTitle(ev, markets, topOutcomeName) {
  const mk = Array.isArray(markets) ? markets : [];
  const openMk = mk.filter((m) => !m?.closed && !m?.archived);
  const multi = openMk.length > 1;
  const evTitle = String(ev?.title || '').trim();
  const fill = String(topOutcomeName || '').trim();

  if (multi && evTitle) {
    if (!isPmStubTitle(evTitle)) return evTitle;
    const expanded = expandPmStubTitle(evTitle, fill);
    if (expanded) return expanded;
    // Keep intentional blanks: "Bitcoin above ___ on August 27?"
    return evTitle;
  }

  const marketQs = openMk.map((m) => String(m?.question || '').trim()).filter(Boolean);
  const candidates = [evTitle, String(ev?.question || '').trim(), ...marketQs]
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  const full = candidates.filter((s) => !isPmStubTitle(s));
  full.sort((a, b) => b.length - a.length);
  if (full[0]) return full[0];
  const stub = candidates.slice().sort((a, b) => b.length - a.length)[0] || '';
  const expanded = expandPmStubTitle(stub, fill);
  if (expanded) return expanded;
  return stub;
}
function pmEventIsLive(ev) {
  if (!ev || ev.closed === true || ev.archived === true) return false;
  if (ev.active === false) return false;
  return isCurrentPmEnd(ev.endDate);
}
/** Unsettled prop markets stuck at exactly 50/50 after the event ended. */
function isPmZombieMarket(m, eventEnded) {
  if (!eventEnded || !m) return false;
  const prices = safeJson(m.outcomePrices, null);
  if (!Array.isArray(prices) || prices.length < 2) return false;
  const yes = Number(prices[0]);
  const no = Number(prices[1]);
  return Number.isFinite(yes) && Number.isFinite(no)
    && Math.abs(yes - 0.5) < 0.0001 && Math.abs(no - 0.5) < 0.0001;
}
function normalizePolymarket(events, { maxEvents = PREDICT_MAX_EVENTS, maxOutcomes = PREDICT_MAX_OUTCOMES, locale = 'en' } = {}) {
  const out = [];
  const seen = new Set();
  for (const ev of Array.isArray(events) ? events : []) {
    if (!pmEventIsLive(ev)) continue;
    const eid = String(ev.id || ev.slug || '');
    if (eid && seen.has(eid)) continue;
    const mk = Array.isArray(ev.markets) ? ev.markets : [];
    const eventEnded = !!(ev.endDate && !isCurrentPmEnd(ev.endDate));
    let rows = [];
    for (const m of mk) {
      if (m.closed || m.archived) continue;
      if (m.enableOrderBook === false) continue;
      if (isPmZombieMarket(m, eventEnded)) continue;
      const prices = safeJson(m.outcomePrices, null);
      const outs = safeJson(m.outcomes, null);
      const tokens = safeJson(m.clobTokenIds, null);
      if (!Array.isArray(prices) || !prices.length) continue;
      const yes = Number(prices[0]);
      if (!Number.isFinite(yes)) continue;
      const noRaw = prices.length > 1 ? Number(prices[1]) : NaN;
      const noPx = Number.isFinite(noRaw) ? noRaw : (1 - yes);
      const tokenYes = Array.isArray(tokens) ? String(tokens[0] || '') : '';
      const tokenNo = Array.isArray(tokens) ? String(tokens[1] || '') : '';
      let name = (m.groupItemTitle && String(m.groupItemTitle).trim())
        || (Array.isArray(outs) && outs[0] && outs[0] !== 'Yes' ? outs[0] : 'Yes');
      rows.push({
        n: String(name).trim(),
        p: Math.max(1, Math.min(99, Math.round(yes * 100))),
        pNo: Math.max(1, Math.min(99, Math.round(noPx * 100))),
        tokenYes,
        tokenNo,
        conditionId: String(m.conditionId || ''),
        marketId: String(m.id || ''),
        slug: String(m.slug || ''),
        tickSize: String(m.orderPriceMinTickSize || '0.01'),
        minSize: Number(m.orderMinSize) || 5,
        negRisk: !!m.negRisk,
        tradeable: !!(tokenYes && tokenNo),
      });
    }
    if (!rows.length) continue;
    // Multi-outcome: drop near-certain / dust prices (useless for staking UI)
    if (rows.length > 1) {
      const usable = rows.filter((r) => r.p >= 5 && r.p <= 95);
      if (usable.length) rows = usable;
      else continue; // all extremes — skip event
    }
    // Show the top favourites first (multi-outcome events can have dozens of markets).
    if (rows.length > 1) rows.sort((a, b) => b.p - a.p);
    rows = rows.slice(0, maxOutcomes);
    const cat = pmCategory(ev);
    if (eid) seen.add(eid);
    // Prefer full market questions over Polymarket stubs like "by...?" / "к...?"
    const q = pickPmTitle(ev, mk, rows[0] && rows[0].n);
    const img = String(ev.image || ev.icon || (mk[0] && (mk[0].image || mk[0].icon)) || '').trim();
    out.push({
      id: 'pm_' + (ev.id || ev.slug || out.length),
      eventId: String(ev.id || ''),
      slug: String(ev.slug || ''),
      cat,
      ico: pmEmoji(cat),
      img,
      q,
      vol: Number(ev.volume || ev.volume24hr || 0) || 0,
      vol24: Number(ev.volume24hr || 0) || 0,
      ends: pmEnds(ev.endDate, locale),
      endsAt: pmEndsAt(ev.endDate),
      time: pmTime(ev.endDate, locale),
      live: pmEventIsLive(ev),
      source: 'polymarket',
      rows,
    });
    if (out.length >= maxEvents) break;
  }
  return out;
}

async function fetchPmEventsPage(params, timeout = 10000) {
  try {
    const { data } = await axios.get('https://gamma-api.polymarket.com/events', {
      params,
      timeout,
      headers: PM_UA,
    });
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

async function mapPool(items, concurrency, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await worker(items[i], i);
    }
  }
  const n = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => run()));
  return out;
}

function dedupePmEvents(batches) {
  const all = [];
  const seen = new Set();
  for (const batch of batches) {
    for (const ev of batch || []) {
      const id = String(ev?.id || ev?.slug || '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      all.push(ev);
    }
  }
  all.sort((a, b) => (Number(b.volume24hr) || 0) - (Number(a.volume24hr) || 0));
  return all;
}

/**
 * mode=quick → volume pages only (fast cold start)
 * mode=full  → volume + tag/league pages (background expand)
 */
async function fetchPolymarketEvents(locale = 'en', mode = 'full') {
  const loc = pmLocale(locale);
  const volPages = mode === 'quick' ? PREDICT_VOLUME_PAGES_QUICK : PREDICT_VOLUME_PAGES_FULL;
  const jobs = [];
  for (let page = 0; page < volPages; page++) {
    jobs.push({
      closed: false,
      active: true,
      archived: false,
      order: 'volume24hr',
      ascending: false,
      limit: PREDICT_PAGE,
      offset: page * PREDICT_PAGE,
      locale: loc,
    });
  }
  if (mode === 'full') {
    for (const tag of PREDICT_TAG_SLUGS) {
      for (let page = 0; page < PREDICT_TAG_PAGES; page++) {
        jobs.push({
          tag_slug: tag,
          closed: false,
          active: true,
          archived: false,
          order: 'volume24hr',
          ascending: false,
          limit: PREDICT_PAGE,
          offset: page * PREDICT_PAGE,
          locale: loc,
        });
      }
    }
  }
  const batches = await mapPool(jobs, PREDICT_FETCH_CONCURRENCY, (params) => fetchPmEventsPage(params));
  return dedupePmEvents(batches);
}

/** Re-fetch events by id with locale (public-search ignores locale). */
async function localizePmEvents(events, locale = 'en') {
  const loc = pmLocale(locale);
  const list = Array.isArray(events) ? events : [];
  if (!list.length || loc === 'en') return list;
  const ids = [...new Set(list.map((e) => e?.id).filter(Boolean).map(String))];
  if (!ids.length) return list;
  const byId = new Map();
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    try {
      const qs = chunk.map((id) => 'id=' + encodeURIComponent(id)).join('&')
        + '&locale=' + encodeURIComponent(loc);
      const { data } = await axios.get('https://gamma-api.polymarket.com/events?' + qs, {
        timeout: 14000,
        headers: { Accept: 'application/json', 'User-Agent': 'grom-exchange/1.0' },
      });
      for (const ev of (Array.isArray(data) ? data : [])) {
        if (ev?.id != null) byId.set(String(ev.id), ev);
      }
    } catch (_) {}
  }
  if (!byId.size) return list;
  return list.map((e) => byId.get(String(e.id)) || e);
}

function looksLikePmSlug(s) {
  const t = String(s || '').trim();
  return /^[a-z0-9]+(?:-[a-z0-9]+)+$/i.test(t) && t.length >= 6 && t.length <= 160;
}

function extractPmSlug(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const m = raw.match(/polymarket\.com\/(?:event|market)\/([a-z0-9][a-z0-9-]*)/i);
  if (m) return m[1];
  if (looksLikePmSlug(raw)) return raw.toLowerCase();
  return '';
}

async function fetchPolymarketBySlug(slug, locale = 'en') {
  const s = String(slug || '').trim();
  if (!s) return [];
  const loc = pmLocale(locale);
  const { data } = await axios.get('https://gamma-api.polymarket.com/events', {
    params: { slug: s, locale: loc },
    timeout: 12000,
    headers: { Accept: 'application/json', 'User-Agent': 'grom-exchange/1.0' },
  });
  return Array.isArray(data) ? data : [];
}

async function fetchPolymarketSearch(q, page = 1, limitPerType = 40, locale = 'en') {
  const loc = pmLocale(locale);
  const { data } = await axios.get('https://gamma-api.polymarket.com/public-search', {
    params: {
      q: String(q || '').trim().slice(0, 120),
      page: Math.max(1, Number(page) || 1),
      limit_per_type: Math.min(50, Math.max(5, Number(limitPerType) || 40)),
      events_status: 'active',
      locale: loc,
    },
    timeout: 14000,
    headers: { Accept: 'application/json', 'User-Agent': 'grom-exchange/1.0' },
  });
  let events = Array.isArray(data?.events) ? data.events : [];
  // public-search often ignores locale — rehydrate titles/questions by id
  if (loc !== 'en' && events.length) {
    events = await localizePmEvents(events, loc);
  }
  const pag = data?.pagination || {};
  return {
    events,
    hasMore: !!pag.hasMore,
    totalResults: Number(pag.totalResults) || events.length,
    page: Math.max(1, Number(page) || 1),
  };
}

function filterStalePredictMarkets(markets) {
  return (markets || []).filter((m) => isCurrentPmEnd(m?.endsAt));
}
function mergePredictEvents(loc, events, { partial = true } = {}) {
  const hit = _predictCacheByLocale.get(loc);
  const prevIds = new Set((hit?.data || []).map((m) => m.eventId || m.id));
  const fresh = normalizePolymarket(events, { maxEvents: PREDICT_MAX_EVENTS, locale: loc });
  if (!fresh.length && hit?.data?.length) return hit.data.length;
  const byId = new Map();
  for (const m of (hit?.data || [])) byId.set(m.id, m);
  for (const m of fresh) byId.set(m.id, m);
  let merged = filterStalePredictMarkets([...byId.values()]);
  merged.sort((a, b) => (b.vol24 || b.vol || 0) - (a.vol24 || a.vol || 0));
  if (merged.length > PREDICT_MAX_EVENTS) merged = merged.slice(0, PREDICT_MAX_EVENTS);
  const added = fresh.filter((m) => !prevIds.has(m.eventId || m.id)).length;
  _predictCacheByLocale.set(loc, {
    ts: Date.now(),
    data: merged,
    meta: {
      upstreamEvents: merged.length,
      capped: merged.length >= PREDICT_MAX_EVENTS,
      maxEvents: PREDICT_MAX_EVENTS,
      locale: loc,
      partial,
    },
    refreshing: hit?.refreshing || false,
    expanding: hit?.expanding || false,
  });
  return { size: merged.length, added };
}

/** Progressive fill: page-by-page so cache grows even if Gamma is slow.
 *  Also re-fetches page 0 and prunes closed events so titles/odds stay in sync. */
async function fillPredictCatalog(loc) {
  const hit0 = _predictCacheByLocale.get(loc);
  if (hit0?.expanding) return;
  if (hit0) hit0.expanding = true;
  const seenIds = new Set();
  const markSeen = (batch) => {
    for (const ev of batch || []) {
      const id = String(ev?.id || '');
      const slug = String(ev?.slug || '');
      if (id) {
        seenIds.add(id);
        seenIds.add('pm_' + id);
      }
      if (slug) {
        seenIds.add(slug);
        seenIds.add('pm_' + slug);
      }
    }
  };
  try {
    // Revalidate from page 0 so top-volume odds/titles don't go stale.
    for (let page = 0; page < PREDICT_VOLUME_PAGES_FULL; page++) {
      const batch = await fetchPmEventsPage({
        closed: false,
        active: true,
        archived: false,
        order: 'volume24hr',
        ascending: false,
        limit: PREDICT_PAGE,
        offset: page * PREDICT_PAGE,
        locale: loc,
      });
      if (!batch.length) break;
      markSeen(batch);
      mergePredictEvents(loc, batch, { partial: true });
    }
    // League / topic tags (sports leagues first)
    for (const tag of PREDICT_TAG_SLUGS) {
      for (let page = 0; page < PREDICT_TAG_PAGES; page++) {
        const batch = await fetchPmEventsPage({
          tag_slug: tag,
          closed: false,
          active: true,
          archived: false,
          order: 'volume24hr',
          ascending: false,
          limit: PREDICT_PAGE,
          offset: page * PREDICT_PAGE,
          locale: loc,
        });
        if (!batch.length) break;
        markSeen(batch);
        mergePredictEvents(loc, batch, { partial: true });
      }
    }
    const cur = _predictCacheByLocale.get(loc);
    // Drop closed/expired events that Gamma no longer returns as active.
    if (cur?.data?.length && seenIds.size >= 40) {
      const before = cur.data.length;
      cur.data = cur.data.filter((m) => {
        const eid = String(m.eventId || '');
        const id = String(m.id || '');
        const slug = String(m.slug || '');
        return (eid && seenIds.has(eid))
          || (id && seenIds.has(id))
          || (slug && seenIds.has(slug));
      });
      if (cur.meta) {
        cur.meta.upstreamEvents = cur.data.length;
        cur.meta.pruned = Math.max(0, before - cur.data.length);
        cur.meta.partial = false;
      }
    } else if (cur?.meta) {
      cur.meta.partial = false;
    }
    if (cur) cur.ts = Date.now();
  } catch (_) {
    /* keep whatever we merged */
  } finally {
    const cur = _predictCacheByLocale.get(loc);
    if (cur) cur.expanding = false;
  }
}

function schedulePredictFill(loc) {
  const hit = _predictCacheByLocale.get(loc);
  if (hit?.expanding) return;
  setTimeout(() => { fillPredictCatalog(loc).catch(() => {}); }, 0);
}

async function rebuildPredictCatalog(loc) {
  // Ultra-fast cold path: first volume page only, then progressive fill
  const first = await fetchPmEventsPage({
    closed: false,
    active: true,
    archived: false,
    order: 'volume24hr',
    ascending: false,
    limit: PREDICT_PAGE,
    offset: 0,
    locale: loc,
  });
  const markets = normalizePolymarket(first, { maxEvents: PREDICT_MAX_EVENTS, locale: loc });
  const meta = {
    upstreamEvents: first.length,
    capped: false,
    maxEvents: PREDICT_MAX_EVENTS,
    locale: loc,
    partial: true,
  };
  if (markets.length) {
    _predictCacheByLocale.set(loc, { ts: Date.now(), data: markets, meta, refreshing: false, expanding: false });
  }
  schedulePredictFill(loc);
  return { markets, meta, cached: false, locale: loc };
}

function schedulePredictRefresh(loc) {
  const hit = _predictCacheByLocale.get(loc);
  if (!hit || hit.refreshing || hit.expanding) return;
  hit.refreshing = true;
  const p = hit.data?.length ? fillPredictCatalog(loc) : rebuildPredictCatalog(loc);
  Promise.resolve(p)
    .catch(() => {})
    .finally(() => {
      const cur = _predictCacheByLocale.get(loc);
      if (cur) cur.refreshing = false;
    });
}

async function ensurePredictCatalog(locale = 'en') {
  const loc = pmLocale(locale);
  const now = Date.now();
  const hit = _predictCacheByLocale.get(loc);
  const pack = (markets, meta, extra) => ({
    markets: filterStalePredictMarkets(markets),
    meta: meta || {},
    locale: loc,
    ...extra,
  });
  if (hit?.data?.length && now - hit.ts < PREDICT_TTL) {
    if (hit.meta?.partial) schedulePredictFill(loc);
    return pack(hit.data, hit.meta, { cached: true });
  }
  // Stale-while-revalidate: never block the UI for 10–20s on refresh
  if (hit?.data?.length && now - hit.ts < PREDICT_STALE_TTL) {
    schedulePredictRefresh(loc);
    return pack(hit.data, hit.meta, { cached: true, stale: true });
  }
  const rebuilt = await rebuildPredictCatalog(loc);
  return pack(rebuilt.markets, rebuilt.meta, { cached: rebuilt.cached });
}

/** Warm EN+RU catalogs so first visitor after deploy isn't cold. */
setTimeout(() => {
  ensurePredictCatalog('en').catch(() => {});
  ensurePredictCatalog('ru').catch(() => {});
}, 1500);
setInterval(() => {
  for (const loc of ['en', 'ru', 'zh', 'es']) schedulePredictRefresh(loc);
}, 90_000);

function slicePredictPage(markets, offset, limit) {
  const off = Math.max(0, Number(offset) || 0);
  const lim = Math.min(PREDICT_MAX_LIMIT, Math.max(1, Number(limit) || PREDICT_DEFAULT_LIMIT));
  const slice = markets.slice(off, off + lim);
  return {
    markets: slice,
    offset: off,
    limit: lim,
    count: slice.length,
    total: markets.length,
    hasMore: off + slice.length < markets.length,
  };
}

export function createMarketRouter() {
  const r = express.Router();

  // Public chart proxy is restricted to the canonical xStock catalog and fixed chart presets.
  registerXstocksChartRoute(r, {
    getCatalog: () => _xstocksCache.data || [],
    getSession: () => ensureYahooSession(),
    fetchChartData: ({ yahoo, range, interval, session }) => {
      const headers = { 'User-Agent': YF_UA, Accept: 'application/json' };
      if (session?.cookie) headers.Cookie = session.cookie;
      const params = { interval, range, includePrePost: 'false' };
      if (session?.crumb) params.crumb = session.crumb;
      return axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}`,
        { timeout: 12000, params, headers },
      ).then(({ data }) => data);
    },
  });

  // Backed xStocks catalog (server-side to bypass CORS on api.backed.fi).
  // Only products whose name ends with "xStock" — never the full LiFi token soup.
  r.get('/xstocks', async (_req, res) => {
    const now = Date.now();
    const send = (payload, cacheSec = 60) => res
      .set('Cache-Control', `public, max-age=${cacheSec}, stale-while-revalidate=120`)
      .json(payload);
    if (_xstocksCache.data && now - _xstocksCache.ts < XSTOCKS_TTL) {
      if (xstocksMetricsMostlyBlank(_xstocksCache.data)) {
        try { scheduleXstocksEnrich(_xstocksCache.data); } catch (_) {}
      }
      return send({ items: _xstocksCache.data, cached: true, source: 'backed' }, 90);
    }
    // Stale-while-revalidate: never make mobile wait 20s+ for Backed pagination.
    if (_xstocksCache.data?.length) {
      const stale = _xstocksCache.data;
      if (xstocksMetricsMostlyBlank(stale)) {
        try { scheduleXstocksEnrich(stale); } catch (_) {}
      }
      if (!_xstocksRefreshPromise) {
        _xstocksRefreshPromise = (async () => {
          try {
            const items = await fetchBackedXstocksCatalog();
            if (items?.length) {
              _xstocksCache = { ts: Date.now(), data: items };
              saveXstocksDiskCache(items);
            }
          } catch (_) {}
          finally { _xstocksRefreshPromise = null; }
        })();
      }
      return send({ items: stale, cached: true, source: 'backed', refreshing: true }, 30);
    }
    // Cold path: coalesce concurrent browsers (landing + stocks + gwx) into one Backed crawl.
    try {
      if (!_xstocksRefreshPromise) {
        _xstocksRefreshPromise = (async () => {
          try {
            const items = await fetchBackedXstocksCatalog();
            if (items?.length) {
              _xstocksCache = { ts: Date.now(), data: items };
              saveXstocksDiskCache(items);
            }
            return items || [];
          } finally {
            _xstocksRefreshPromise = null;
          }
        })();
      }
      const items = await _xstocksRefreshPromise;
      if (items?.length) {
        return send({ items, source: 'backed', count: items.length }, 60);
      }
      return res.status(502).json({ items: [], error: 'empty' });
    } catch (e) {
      if (_xstocksCache.data?.length) {
        return send({ items: _xstocksCache.data, cached: true, source: 'backed', error: 'upstream' }, 15);
      }
      return res.status(502).json({ items: [], error: String(e?.message || e) });
    }
  });

  // Public builder config (builderCode is attribution id — safe to expose).
  r.get('/predict/config', (_req, res) => {
    const builderCode = String(config.polymarket?.builderCode || process.env.GROM_POLYMARKET_BUILDER_CODE || '').trim();
    const enabled = !!builderCode && /^0x[a-fA-F0-9]{64}$/.test(builderCode);
    res.json({
      enabled,
      builderCode: enabled ? builderCode : '',
      chainId: 137,
      clobHost: '/api/market/clob',
      dataHost: '/api/market/pm-data',
      collateral: 'pUSD',
      docs: 'https://docs.polymarket.com/programs/builders/overview',
    });
  });

  // Live prediction markets from Polymarket (server-side to bypass CORS).
  // Query: ?q= / ?slug= / ?lang= / ?locale= / ?cat= / ?offset=&limit= / ?page=
  const PREDICT_CATS = new Set(['all', 'sport', 'crypto', 'esports', 'politics', 'culture', 'finance', 'economy']);
  function filterPredictCat(markets, cat) {
    const c = String(cat || 'all').toLowerCase();
    if (!c || c === 'all' || !PREDICT_CATS.has(c)) return markets || [];
    return (markets || []).filter((m) => m && m.cat === c);
  }

  r.get('/predict', async (req, res) => {
    const qRaw = String(req.query.q || req.query.search || '').trim();
    const slugParam = String(req.query.slug || '').trim() || extractPmSlug(qRaw);
    const locale = pmLocale(req.query.lang || req.query.locale || 'en');
    const catParam = String(req.query.cat || 'all').trim().toLowerCase() || 'all';
    const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10) || 0);
    const limit = Math.min(
      PREDICT_MAX_LIMIT,
      Math.max(1, parseInt(String(req.query.limit || String(PREDICT_DEFAULT_LIMIT)), 10) || PREDICT_DEFAULT_LIMIT),
    );
    const searchPage = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const wantAll = String(req.query.all || '') === '1'; // legacy: return full browse catalog

    try {
      // 1) Exact slug (or polymarket.com/event/<slug> pasted into search)
      if (slugParam && (!qRaw || extractPmSlug(qRaw) === slugParam)) {
        const cacheKey = `slug:${locale}:${slugParam.toLowerCase()}`;
        const hit = _predictSearchCache.get(cacheKey);
        if (hit && Date.now() - hit.ts < PREDICT_SEARCH_TTL) {
          return res.json(hit.payload);
        }
        const events = await fetchPolymarketBySlug(slugParam, locale);
        const markets = normalizePolymarket(events, { maxEvents: 20, locale });
        const payload = {
          markets,
          source: 'polymarket',
          mode: 'slug',
          slug: slugParam,
          locale,
          count: markets.length,
          total: markets.length,
          offset: 0,
          limit,
          hasMore: false,
          page: 1,
        };
        _predictSearchCache.set(cacheKey, { ts: Date.now(), payload });
        return res.json(payload);
      }

      // 2) Free-text / slug search via Polymarket public-search (+ local catalog filter)
      if (qRaw) {
        const cacheKey = `q:${locale}:${qRaw.toLowerCase()}:p${searchPage}:l${limit}`;
        const hit = _predictSearchCache.get(cacheKey);
        if (hit && Date.now() - hit.ts < PREDICT_SEARCH_TTL) {
          return res.json(hit.payload);
        }

        let events = [];
        let hasMore = false;
        let totalResults = 0;
        try {
          const searched = await fetchPolymarketSearch(qRaw, searchPage, Math.min(50, limit), locale);
          events = searched.events;
          hasMore = searched.hasMore;
          totalResults = searched.totalResults;
        } catch (_) {}

        // Also try slug fetch if query looks like a slug and search was thin
        if (looksLikePmSlug(qRaw) && events.length < 3) {
          try {
            const bySlug = await fetchPolymarketBySlug(qRaw.toLowerCase(), locale);
            events = bySlug.concat(events);
          } catch (_) {}
        }

        let markets = normalizePolymarket(events, { maxEvents: PREDICT_MAX_LIMIT, locale });

        // Enrich with catalog matches (volume-ranked) when search is sparse
        if (markets.length < 8) {
          try {
            const cat = await ensurePredictCatalog(locale);
            const ql = qRaw.toLowerCase();
            const extra = (cat.markets || []).filter((m) => {
              const blob = ((m.q || '') + ' ' + (m.slug || '') + ' ' + (m.eventId || '')).toLowerCase();
              return blob.includes(ql);
            });
            const seen = new Set(markets.map((m) => m.id));
            for (const m of extra) {
              if (seen.has(m.id)) continue;
              markets.push(m);
              seen.add(m.id);
              if (markets.length >= limit) break;
            }
          } catch (_) {}
        }

        markets = markets.slice(0, limit);
        const payload = {
          markets,
          source: 'polymarket',
          mode: 'search',
          q: qRaw,
          locale,
          count: markets.length,
          total: totalResults || markets.length,
          offset: (searchPage - 1) * limit,
          limit,
          hasMore,
          page: searchPage,
        };
        _predictSearchCache.set(cacheKey, { ts: Date.now(), payload });
        return res.json(payload);
      }

      // 3) Browse catalog (volume-ranked), paginated for mobile-friendly UI
      const catalog = await ensurePredictCatalog(locale);
      const filtered = filterPredictCat(catalog.markets, catParam);
      if (wantAll) {
        return res.json({
          markets: filtered,
          source: 'polymarket',
          mode: 'browse',
          locale,
          cat: catParam,
          cached: catalog.cached,
          count: filtered.length,
          total: filtered.length,
          offset: 0,
          limit: filtered.length,
          hasMore: false,
          ...(catalog.meta || {}),
        });
      }
      const page = slicePredictPage(filtered, offset, limit);
      return res.json({
        ...page,
        source: 'polymarket',
        mode: 'browse',
        locale,
        cat: catParam,
        cached: catalog.cached,
        ...(catalog.meta || {}),
      });
    } catch (e) {
      const fallback = _predictCacheByLocale.get(locale) || _predictCacheByLocale.get('en');
      if (fallback?.data?.length && !qRaw && !slugParam) {
        const page = slicePredictPage(filterPredictCat(fallback.data, catParam), offset, limit);
        return res.json({
          ...page,
          cached: true,
          source: 'polymarket',
          mode: 'browse',
          locale,
          cat: catParam,
          error: 'upstream',
          ...(fallback.meta || {}),
        });
      }
      return res.status(502).json({ markets: [], error: String(e?.message || e), source: 'polymarket', locale });
    }
  });

  // CLOB proxy — browser SDK hits our origin (avoids CORS / builder-fee 404 issues).
  r.use('/clob', async (req, res) => {
    try {
      const sub = req.url || '/';
      const url = 'https://clob.polymarket.com' + (sub.startsWith('/') ? sub : '/' + sub);
      // Soft-stub builder fee lookup so browser SDK does not hard-fail on CORS/404.
      if (/\/fees\/builder-fees\//i.test(sub)) {
        return res.json({ base_fee: 0, fee_rate: 0, feeRate: 0, rate: 0 });
      }
      const headers = { Accept: 'application/json', 'User-Agent': 'grom-exchange/1.0' };
      for (const h of ['content-type', 'poly_api_key', 'poly_passphrase', 'poly_signature', 'poly_timestamp', 'poly_address', 'authorization']) {
        const v = req.headers[h];
        if (v) headers[h] = v;
      }
      const upstream = await axios({
        method: req.method,
        url,
        data: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
        headers,
        timeout: 20000,
        validateStatus: () => true,
        responseType: 'json',
      });
      res.status(upstream.status).set('cache-control', 'no-store');
      return res.send(upstream.data);
    } catch (e) {
      return res.status(502).json({ error: String(e?.message || e) });
    }
  });

  // Data API proxy (positions).
  r.get('/pm-data/positions', async (req, res) => {
    try {
      const user = String(req.query.user || '');
      if (!/^0x[a-fA-F0-9]{40}$/.test(user)) return res.status(400).json({ error: 'bad user' });
      const { data } = await axios.get('https://data-api.polymarket.com/positions', {
        params: { user, sizeThreshold: 0 },
        timeout: 12000,
        headers: { Accept: 'application/json', 'User-Agent': 'grom-exchange/1.0' },
      });
      return res.json(Array.isArray(data) ? data : (data?.positions || []));
    } catch (e) {
      return res.status(502).json({ error: String(e?.message || e) });
    }
  });

  async function refreshQuotesPayload() {
    const payload = fallbackQuotes();
    if (_quotesCache.data?.crypto) {
      Object.assign(payload.crypto, _quotesCache.data.crypto);
      Object.assign(payload.cryptoChange24h, _quotesCache.data.cryptoChange24h || {});
      Object.assign(payload.fx, _quotesCache.data.fx || {});
      Object.assign(payload.equities, _quotesCache.data.equities || {});
    }

    const jobs = [];

    jobs.push((async () => {
      try {
        const ids = Object.values(CG_IDS).join(',');
        const headers = { Accept: 'application/json', 'User-Agent': 'grom-exchange/1.0' };
        const cgKey = String(process.env.COINGECKO_API_KEY || process.env.GROM_COINGECKO_API_KEY || '').trim();
        if (cgKey) headers['x-cg-pro-api-key'] = cgKey;
        const base = cgKey ? 'https://pro-api.coingecko.com/api/v3' : 'https://api.coingecko.com/api/v3';
        const { data } = await axios.get(`${base}/simple/price`, {
          params: { ids, vs_currencies: 'usd', include_24hr_change: true },
          timeout: 2500,
          headers,
        });
        for (const [asset, id] of Object.entries(CG_IDS)) {
          const price = Number(data?.[id]?.usd);
          if (Number.isFinite(price) && price > 0) payload.crypto[asset] = price;
          const change24h = Number(data?.[id]?.usd_24h_change);
          if (Number.isFinite(change24h)) payload.cryptoChange24h[asset] = change24h;
        }
      } catch (_) {}
    })());

    jobs.push((async () => {
      try {
        const { data } = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 2000 });
        if (data && data.rates) {
          const eur = Number(data.rates.EUR);
          const gbp = Number(data.rates.GBP);
          const jpy = Number(data.rates.JPY);
          if (eur) payload.fx.EURUSD = 1 / eur;
          if (gbp && jpy) payload.fx.GBPJPY = (1 / gbp) * jpy;
          if (jpy) payload.fx.USDJPY = jpy;
        }
      } catch (_) {}
    })());

    jobs.push((async () => {
      try {
        const { data } = await axios.get('https://stooq.com/q/l/?s=aapl.us,tsla.us,msft.us,nvda.us&i=d', { timeout: 2000 });
        String(data || '').split('\n').forEach((line) => {
          const parts = line.split(',');
          if (parts.length < 7 || parts[0] === 'Symbol') return;
          const symbol = String(parts[0]).toUpperCase();
          const close = Number(parts[6]);
          if (!Number.isFinite(close)) return;
          if (symbol === 'AAPL.US') payload.equities.AAPL = close;
          else if (symbol === 'TSLA.US') payload.equities.TSLA = close;
          else if (symbol === 'MSFT.US') payload.equities.MSFT = close;
          else if (symbol === 'NVDA.US') payload.equities.NVDA = close;
        });
      } catch (_) {}
    })());

    await Promise.all(jobs);
    _quotesCache = { ts: Date.now(), data: payload };
    return payload;
  }

  r.get('/quotes', async (_req, res) => {
    const now = Date.now();
    if (_quotesCache.data && now - _quotesCache.ts < QUOTES_TTL_MS) {
      return res.json(_quotesCache.data);
    }
    if (_quotesCache.data && now - _quotesCache.ts < QUOTES_STALE_MS) {
      if (!_quotesRefreshPromise) {
        _quotesRefreshPromise = refreshQuotesPayload()
          .catch(() => null)
          .finally(() => { _quotesRefreshPromise = null; });
      }
      return res.json(_quotesCache.data);
    }
    try {
      if (!_quotesRefreshPromise) {
        _quotesRefreshPromise = refreshQuotesPayload()
          .finally(() => { _quotesRefreshPromise = null; });
      }
      const payload = await _quotesRefreshPromise;
      return res.json(payload || fallbackQuotes());
    } catch (_) {
      return res.json(_quotesCache.data || fallbackQuotes());
    }
  });

  /** GeckoTerminal trending — cached server proxy (avoids browser 429 bursts). */
  r.get('/trending', async (req, res) => {
    try {
      const { getTrending } = await import('./trending.js');
      const payload = await getTrending(req.query.net);
      res.json(payload);
    } catch (e) {
      res.status(502).json({ net: String(req.query.net || 'all'), rows: [], error: String(e?.message || e) });
    }
  });

  return r;
}

export default createMarketRouter;
