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
function pmEventTimes(ev) {
  let start = ev.startDate || ev.startTime || null;
  let end = ev.endDate || ev.endTime || null;
  for (const m of Array.isArray(ev.markets) ? ev.markets : []) {
    if (!start && m.gameStartTime) start = m.gameStartTime;
    if (!end && m.endDate) end = m.endDate;
  }
  return { start, end };
}
// LIVE = in progress or resolving very soon (sport match today, not long-dated markets).
function pmIsLive(ev, cat) {
  const { start, end } = pmEventTimes(ev);
  const now = Date.now();
  const endMs = end ? new Date(end).getTime() : NaN;
  const startMs = start ? new Date(start).getTime() : NaN;
  if (!Number.isFinite(endMs)) return false;

  const title = String(ev.title || ev.question || '').toLowerCase();
  const vsMatch = /\bvs\.?\b|\svs?\s|\sv\s|\s@\s/.test(title);
  const sportish = cat === 'sport' || cat === 'esports';

  if (Number.isFinite(startMs) && startMs <= now && endMs > now) return true;

  const hours = (endMs - now) / 3600000;
  if (sportish && vsMatch && hours >= -8 && hours <= 36) return true;
  if (cat === 'esports' && hours >= -4 && hours <= 24) return true;
  if ((cat === 'politics' || cat === 'crypto') && hours >= 0 && hours <= 24) return true;

  return false;
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
    const times = pmEventTimes(ev);
    out.push({
      id: 'pm_' + (ev.id || ev.slug || out.length),
      cat,
      ico: pmEmoji(cat),
      q: String(ev.title || ev.question || '').slice(0, 150),
      vol: Number(ev.volume || ev.volume24hr || 0) || 0,
      vol24: Number(ev.volume24hr || 0) || 0,
      ends: pmEnds(times.end),
      endsAt: pmEndsAt(times.end),
      time: pmTime(times.end),
      live: pmIsLive(ev, cat),
      rows,
    });
    if (out.length >= 48) break;
  }
  return out;
}

export function createMarketRouter() {
  const r = express.Router();

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
