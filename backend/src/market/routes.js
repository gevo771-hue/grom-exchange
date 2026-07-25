import express from 'express';
import axios from 'axios';

const BINANCE_SYMBOLS = [
  'BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','DOGEUSDT','AVAXUSDT','LINKUSDT',
  'TONUSDT','TRXUSDT','DOTUSDT','ATOMUSDT','NEARUSDT','LTCUSDT','BCHUSDT','SUIUSDT','1000PEPEUSDT',
  '1000SHIBUSDT','APTUSDT','UNIUSDT','ETCUSDT','ICPUSDT','ARBUSDT','OPUSDT'
];

function fallbackQuotes() {
  return {
    crypto: {
      BTC: 104218.4, ETH: 3684.15, SOL: 182.27, BNB: 612.88, XRP: 2.48, ADA: 0.752, DOGE: 0.1942,
      AVAX: 38.44, LINK: 17.28, TON: 6.42, TRX: 0.1462, DOT: 7.11, ATOM: 8.54, NEAR: 6.37, LTC: 96.42,
      BCH: 522.18, SUI: 1.84, PEPE: 0.0000124, SHIB: 0.0000246, APT: 9.87, UNI: 11.42, ETC: 31.75,
      ICP: 14.33, ARB: 1.06, OP: 2.91,
    },
    fx: { EURUSD: 1.0842, GBPJPY: 193.482, USDJPY: 151.12 },
    equities: { AAPL: 206.8, TSLA: 173.4, MSFT: 417.2, NVDA: 922.4 },
  };
}

// ---- Polymarket prediction-markets proxy (public, cached) ----
let _predictCache = { ts: 0, data: null };
const PREDICT_TTL = 60_000;

// ---- Backed xStocks catalog proxy (public, cached) — browser can't call api.backed.fi (no CORS) ----
let _xstocksCache = { ts: 0, data: null };
const XSTOCKS_TTL = 5 * 60_000;
const GWX_NET = {
  Ethereum: 1, Arbitrum: 42161, Optimism: 10, BinanceSmartChain: 56,
  Base: 8453, Polygon: 137, Avalanche: 43114, Mantle: 5000,
};

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

function toYahooSymbol(sym) {
  // BRK.B → BRK-B, etc.
  return String(sym || '').toUpperCase().replace(/\./g, '-');
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

/** Batch Yahoo quotes → Map(underlyingSym → { vol24, mc, equityPx, chg }) */
async function fetchYahooEquityMetrics(symbols) {
  const uniq = [...new Set((symbols || []).map((s) => String(s || '').toUpperCase()).filter(Boolean))];
  const out = new Map();
  if (!uniq.length) return out;
  let session;
  try { session = await ensureYahooSession(); } catch (_) { return out; }

  const chunkSize = 80;
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const chunk = uniq.slice(i, i + chunkSize);
    const ysyms = chunk.map(toYahooSymbol);
    try {
      const { data } = await axios.get('https://query1.finance.yahoo.com/v7/finance/quote', {
        timeout: 12000,
        params: { symbols: ysyms.join(','), crumb: session.crumb },
        headers: { 'User-Agent': YF_UA, Cookie: session.cookie, Accept: 'application/json' },
      });
      const rows = data?.quoteResponse?.result || [];
      const byY = new Map(rows.map((r) => [String(r.symbol || '').toUpperCase(), r]));
      for (let j = 0; j < chunk.length; j++) {
        const sym = chunk[j];
        const r = byY.get(ysyms[j]) || byY.get(sym);
        if (!r) continue;
        const px = Number(r.regularMarketPrice);
        const shares = Number(r.regularMarketVolume);
        const mc = Number(r.marketCap);
        const chg = Number(r.regularMarketChangePercent);
        const dollarVol = (Number.isFinite(px) && Number.isFinite(shares) && px > 0 && shares > 0)
          ? px * shares
          : 0;
        out.set(sym, {
          vol24: fmtCompactUsd(dollarVol),
          mc: fmtCompactUsd(mc),
          equityPx: Number.isFinite(px) && px > 0 ? px : 0,
          chg: Number.isFinite(chg) ? chg : 0,
        });
      }
    } catch (e) {
      // Crumb expiry → reset once and retry this chunk
      if (String(e?.response?.status || '') === '401' || String(e?.response?.status || '') === '403') {
        _yfSession = { crumb: '', cookie: '', ts: 0 };
        try {
          session = await ensureYahooSession();
          i -= chunkSize; // retry chunk
          continue;
        } catch (_) { break; }
      }
    }
  }
  return out;
}

async function enrichXstocksMetrics(items) {
  if (!Array.isArray(items) || !items.length) return items;
  const metrics = await fetchYahooEquityMetrics(items.map((it) => it.sym));
  if (!metrics.size) return items;
  for (const it of items) {
    const m = metrics.get(String(it.sym || '').toUpperCase());
    if (!m) continue;
    if (m.vol24 && m.vol24 !== '—') it.vol24 = m.vol24;
    if (m.mc && m.mc !== '—') it.mc = m.mc;
    // Keep LiFi/token mid as live trade price when FE fills it; seed equity px if empty.
    if (!(Number(it.price) > 0) && m.equityPx > 0) it.price = m.equityPx;
    if (m.chg) it.chg = m.chg;
  }
  return items;
}

function safeJson(str, def) { try { return JSON.parse(str); } catch { return def; } }
function pmCategory(ev) {
  const tags = Array.isArray(ev.tags) ? ev.tags.map((t) => t.label || t.slug || '') : [];
  const hay = [ev.category || '', ev.title || '', ...tags].join(' ').toLowerCase();
  const has = (...ks) => ks.some((k) => hay.includes(k));
  if (has('esport', 'league of legends', 'dota', 'counter-strike', 'cs2', 'valorant', 'gaming')) return 'esports';
  if (has('sport', 'nfl', 'nba', 'mlb', 'soccer', 'football', 'tennis', 'baseball', 'basketball', 'hockey', 'ufc', 'f1', 'golf', 'world cup', 'champions league')) return 'sport';
  if (has('crypto', 'bitcoin', 'ethereum', 'solana', 'memecoin', 'altcoin', 'dogecoin', 'ripple')) return 'crypto';
  if (has('econom', 'fed ', 'inflation', 'interest rate', 'cpi', 'gdp', 'jobs', 'recession', 'rate cut')) return 'economy';
  if (has('stock', 'earnings', 'nasdaq', 's&p', 'tech', 'business', 'ipo', 'company', 'tesla', 'nvidia', 'apple')) return 'finance';
  if (has('politic', 'election', 'trump', 'biden', 'senate', 'congress', 'geopolit', 'war', 'president')) return 'politics';
  if (has('culture', 'movie', 'music', 'tv ', 'celebrit', 'award', 'oscar', 'entertain', 'pop ', 'grammy')) return 'culture';
  return 'all';
}
function pmEmoji(cat) {
  return { sport: '⚽', crypto: '🪙', esports: '🎮', politics: '🏛️', culture: '🎬', finance: '💹', economy: '📊' }[cat] || '🌐';
}
function pmEnds(iso) {
  if (!iso) return '';
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  try { return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }); } catch { return ''; }
}
function pmTime(iso) {
  if (!iso) return '';
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  try { return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}
function pmEndsAt(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function normalizePolymarket(events) {
  const out = [];
  for (const ev of Array.isArray(events) ? events : []) {
    const mk = Array.isArray(ev.markets) ? ev.markets : [];
    let rows = [];
    for (const m of mk) {
      if (m.closed || m.archived) continue;
      const prices = safeJson(m.outcomePrices, null);
      const outs = safeJson(m.outcomes, null);
      if (!Array.isArray(prices) || !prices.length) continue;
      const yes = Number(prices[0]);
      if (!Number.isFinite(yes)) continue;
      let name = (m.groupItemTitle && String(m.groupItemTitle).trim())
        || (Array.isArray(outs) && outs[0] && outs[0] !== 'Yes' ? outs[0] : 'Да');
      rows.push({ n: String(name).slice(0, 42), p: Math.max(1, Math.min(99, Math.round(yes * 100))) });
    }
    if (!rows.length) continue;
    // Show the top favourites first (multi-outcome events can have dozens of markets).
    if (rows.length > 1) rows.sort((a, b) => b.p - a.p);
    rows = rows.slice(0, 6);
    const cat = pmCategory(ev);
    out.push({
      id: 'pm_' + (ev.id || ev.slug || out.length),
      cat,
      ico: pmEmoji(cat),
      q: String(ev.title || ev.question || '').slice(0, 150),
      vol: Number(ev.volume || ev.volume24hr || 0) || 0,
      vol24: Number(ev.volume24hr || 0) || 0,
      ends: pmEnds(ev.endDate),
      endsAt: pmEndsAt(ev.endDate),
      time: pmTime(ev.endDate),
      live: true,
      rows,
    });
    if (out.length >= 48) break;
  }
  return out;
}

export function createMarketRouter() {
  const r = express.Router();

  // Backed xStocks catalog (server-side to bypass CORS on api.backed.fi).
  // Only products whose name ends with "xStock" — never the full LiFi token soup.
  r.get('/xstocks', async (_req, res) => {
    const now = Date.now();
    if (_xstocksCache.data && now - _xstocksCache.ts < XSTOCKS_TTL) {
      return res.json({ items: _xstocksCache.data, cached: true, source: 'backed' });
    }
    try {
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
        const underlying = String(n.underlyingSymbol || tokenSym.replace(/x$/i, '') || tokenSym).toUpperCase();
        if (!underlying || seen.has(underlying)) continue;
        const addrs = {};
        const chains = [];
        for (const dep of (n.deployments || [])) {
          const cid = GWX_NET[dep.network];
          const addr = dep.address || dep.wrapperAddressV2 || dep.wrapperAddress;
          if (!cid || !addr || !/^0x[a-fA-F0-9]{40}$/i.test(addr)) continue;
          addrs[cid] = addr;
          chains.push(cid);
        }
        if (!chains.length) continue;
        seen.add(underlying);
        const pref = [1, 42161, 10, 56, 8453].find((c) => addrs[c]) || chains[0];
        items.push({
          sym: underlying,
          tokenSym,
          name,
          logo: n.logo || '',
          addrs,
          chains,
          chain: pref,
          chainLabel: Object.keys(GWX_NET).find((k) => GWX_NET[k] === pref) || String(pref),
          decimals: 18,
          tradeable: true,
          halted: !!n.isTradingHalted,
          price: 0,
          chg: 0,
          vol24: '—',
          mc: '—',
        });
      }
      items.sort((a, b) => a.sym.localeCompare(b.sym));
      // Underlying equity 24h $ volume + market cap (Yahoo). Token mid stays FE/LiFi.
      try { await enrichXstocksMetrics(items); } catch (_) {}
      if (items.length) _xstocksCache = { ts: now, data: items };
      return res.json({ items, source: 'backed', count: items.length });
    } catch (e) {
      if (_xstocksCache.data?.length) {
        return res.json({ items: _xstocksCache.data, cached: true, source: 'backed', error: 'upstream' });
      }
      return res.status(502).json({ items: [], error: String(e?.message || e) });
    }
  });

  // Live prediction markets from Polymarket (server-side to bypass CORS).
  r.get('/predict', async (_req, res) => {
    const now = Date.now();
    if (_predictCache.data && now - _predictCache.ts < PREDICT_TTL) {
      return res.json({ markets: _predictCache.data, cached: true });
    }
    try {
      const { data } = await axios.get('https://gamma-api.polymarket.com/events', {
        params: { closed: false, active: true, archived: false, order: 'volume24hr', ascending: false, limit: 120 },
        timeout: 7000,
      });
      const markets = normalizePolymarket(data);
      if (markets.length) _predictCache = { ts: now, data: markets };
      return res.json({ markets, source: 'polymarket' });
    } catch (_) {
      return res.json({ markets: _predictCache.data || [], error: 'upstream' });
    }
  });

  r.get('/quotes', async (_req, res) => {
    const payload = fallbackQuotes();

    try {
      const { data } = await axios.get('https://api.binance.com/api/v3/ticker/price', {
        params: { symbols: JSON.stringify(BINANCE_SYMBOLS) },
        timeout: 5000,
      });
      if (Array.isArray(data)) {
        data.forEach((row) => {
          const price = Number(row.price);
          if (!Number.isFinite(price)) return;
          const symbol = String(row.symbol || '').toUpperCase();
          const set = (asset, value) => { payload.crypto[asset] = value; };
          if (symbol === 'BTCUSDT') set('BTC', price);
          else if (symbol === 'ETHUSDT') set('ETH', price);
          else if (symbol === 'SOLUSDT') set('SOL', price);
          else if (symbol === 'BNBUSDT') set('BNB', price);
          else if (symbol === 'XRPUSDT') set('XRP', price);
          else if (symbol === 'ADAUSDT') set('ADA', price);
          else if (symbol === 'DOGEUSDT') set('DOGE', price);
          else if (symbol === 'AVAXUSDT') set('AVAX', price);
          else if (symbol === 'LINKUSDT') set('LINK', price);
          else if (symbol === 'TONUSDT') set('TON', price);
          else if (symbol === 'TRXUSDT') set('TRX', price);
          else if (symbol === 'DOTUSDT') set('DOT', price);
          else if (symbol === 'ATOMUSDT') set('ATOM', price);
          else if (symbol === 'NEARUSDT') set('NEAR', price);
          else if (symbol === 'LTCUSDT') set('LTC', price);
          else if (symbol === 'BCHUSDT') set('BCH', price);
          else if (symbol === 'SUIUSDT') set('SUI', price);
          else if (symbol === '1000PEPEUSDT') set('PEPE', price / 1000);
          else if (symbol === '1000SHIBUSDT') set('SHIB', price / 1000);
          else if (symbol === 'APTUSDT') set('APT', price);
          else if (symbol === 'UNIUSDT') set('UNI', price);
          else if (symbol === 'ETCUSDT') set('ETC', price);
          else if (symbol === 'ICPUSDT') set('ICP', price);
          else if (symbol === 'ARBUSDT') set('ARB', price);
          else if (symbol === 'OPUSDT') set('OP', price);
        });
      }
    } catch (_) {}

    try {
      const { data } = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 5000 });
      if (data && data.rates) {
        const eur = Number(data.rates.EUR);
        const gbp = Number(data.rates.GBP);
        const jpy = Number(data.rates.JPY);
        if (eur) payload.fx.EURUSD = 1 / eur;
        if (gbp && jpy) payload.fx.GBPJPY = (1 / gbp) * jpy;
        if (jpy) payload.fx.USDJPY = jpy;
      }
    } catch (_) {}

    try {
      const { data } = await axios.get('https://stooq.com/q/l/?s=aapl.us,tsla.us,msft.us,nvda.us&i=d', { timeout: 5000 });
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

    res.json(payload);
  });

  return r;
}

export default createMarketRouter;
