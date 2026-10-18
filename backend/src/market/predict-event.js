import axios from 'axios';
import rateLimit from 'express-rate-limit';

const ID = /^[1-9][0-9]{0,19}$/;
const TOKEN = /^[0-9]{1,80}$/;
const RANGES = Object.freeze({ '1d': 5, '1w': 30, '1m': 120, max: 360 });
const text = (v, limit = 20000) => typeof v === 'string' ? v.slice(0, limit) : '';
const list = v => { try { const a = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(a) ? a : []; } catch { return []; } };
const number = v => v == null || v === '' || typeof v === 'boolean' || !Number.isFinite(Number(v)) ? null : Number(v);
const price = v => { const n = number(v); return n != null && n >= 0 && n <= 1 ? n : null; };
const positive = v => { const n = number(v); return n != null && n >= 0 ? n : null; };
function https(v) { try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; } }
function date(v) { const t = Date.parse(v); return Number.isFinite(t) ? new Date(t).toISOString() : ''; }

/** Detail retains all outcomes, including near-certain and closed markets omitted by browse. */
export function normalizePredictionEvent(raw, now = Date.now()) {
  if (!raw || !ID.test(String(raw.id)) || !raw.title || !Array.isArray(raw.markets)) throw new Error('invalid_event');
  const rows = raw.markets.map(m => {
    const outcomes = list(m.outcomes), prices = list(m.outcomePrices), tokens = list(m.clobTokenIds);
    const yes = outcomes.findIndex(v => /^(yes|up)$/i.test(String(v)));
    const no = outcomes.findIndex(v => /^(no|down)$/i.test(String(v)));
    const binary = outcomes.length === 2 && yes >= 0 && no >= 0;
    const py = binary ? price(prices[yes]) : null, pn = binary ? price(prices[no]) : null;
    const tokenYes = binary && TOKEN.test(String(tokens[yes] || '')) ? String(tokens[yes]) : '';
    const tokenNo = binary && TOKEN.test(String(tokens[no] || '')) ? String(tokens[no]) : '';
    const endsAt = date(m.endDate || raw.endDate);
    const closed = !!(raw.closed || raw.archived || m.closed || m.archived || (endsAt && Date.parse(endsAt) <= now));
    return {
      id: text(String(m.id || ''), 80), n: text(m.groupItemTitle || m.question || raw.title, 500),
      question: text(m.question, 500), description: text(m.description), resolutionSource: https(m.resolutionSource || raw.resolutionSource),
      p: py == null ? null : py * 100, pNo: pn == null ? null : pn * 100,
      tokenYes, tokenNo, conditionId: text(m.conditionId, 80), slug: text(m.slug, 200),
      tickSize: ['0.1', '0.01', '0.001', '0.0001'].includes(String(m.orderPriceMinTickSize)) ? String(m.orderPriceMinTickSize) : '0.01',
      minSize: positive(m.orderMinSize), negRisk: !!(m.negRisk || raw.negRisk), vol: positive(m.volumeNum ?? m.volume), endsAt, closed,
      tradeable: binary && !!tokenYes && !!tokenNo && py > 0 && py < 1 && pn > 0 && pn < 1 && !closed && raw.active !== false && m.active !== false && m.enableOrderBook === true && m.acceptingOrders === true,
    };
  });
  return { id: String(raw.id), q: text(raw.title, 500), slug: text(raw.slug, 200), img: https(raw.image || raw.icon),
    description: text(raw.description), resolutionSource: https(raw.resolutionSource), endsAt: date(raw.endDate),
    vol: positive(raw.volume), vol24: positive(raw.volume24hr), closed: !!(raw.closed || raw.archived),
    tags: list(raw.tags).map(t => text(t.label, 80)).filter(Boolean).slice(0, 8), rows, fetchedAt: new Date(now).toISOString(), source: 'Polymarket' };
}

export function normalizePredictionHistory(raw) {
  if (!Array.isArray(raw?.history)) throw new Error('invalid_history');
  const unique = new Map();
  for (const point of raw.history) {
    const t = number(point?.t), p = price(point?.p);
    if (t > 0 && t < 1e11 && p != null) unique.set(t, { t, p });
  }
  const points = [...unique.values()].sort((a, b) => a.t - b.t);
  // Bound the response while retaining both endpoints and the whole period.
  if (points.length <= 2000) return points;
  return Array.from({ length: 2000 }, (_, i) => points[Math.round(i * (points.length - 1) / 1999)]);
}

export function registerPredictionEventRoutes(router, { get = axios.get, now = Date.now, maxEntries = 128 } = {}) {
  const cache = new Map(), pending = new Map();
  const limiter = rateLimit({ windowMs: 60000, max: 90, standardHeaders: true, legacyHeaders: false });
  async function read(key, url, params, normalize) {
    const hit = cache.get(key);
    if (hit && now() - hit.at < 30000) return hit.data;
    if (pending.has(key)) return pending.get(key);
    if (pending.size >= 20) throw new Error('upstream_busy');
    const job = Promise.resolve().then(async () => {
      const response = await get(url, { params, timeout: 12000, maxRedirects: 0, maxContentLength: 4000000, headers: { 'User-Agent': 'grom-exchange/1.0' } });
      const data = normalize(response.data);
      cache.delete(key);
      while (cache.size >= maxEntries) cache.delete(cache.keys().next().value);
      cache.set(key, { at: now(), data });
      return data;
    }).finally(() => pending.delete(key));
    pending.set(key, job);
    return job;
  }
  router.get('/predict/event/:id', limiter, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!ID.test(req.params.id)) return res.status(400).json({ error: 'invalid_event_id' });
    const lang = ['en', 'es', 'zh', 'ru', 'hi', 'tr', 'pt', 'fr', 'de'].includes(req.query.lang) ? req.query.lang : 'en';
    try {
      const url = `https://gamma-api.polymarket.com/events/${req.params.id}`;
      // Trading identities always come from canonical English outcomes. Gamma translates
      // Yes/No in localized responses; translated labels must never choose a token side.
      const [data, localized] = await Promise.all([
        read(`event:${req.params.id}`, url, {}, raw => {
          const event = normalizePredictionEvent(raw, now());
          if (event.id !== req.params.id) throw new Error('event_mismatch');
          return event;
        }),
        lang === 'en' ? null : read(`event-text:${req.params.id}:${lang}`, url, { locale: lang }, raw => {
          if (String(raw?.id) !== req.params.id) throw new Error('event_mismatch');
          return { q: text(raw.title, 500), tags: list(raw.tags).map(t => text(t.label, 80)).filter(Boolean).slice(0, 8),
            rows: list(raw.markets).map(m => ({ id: String(m.id), n: text(m.groupItemTitle || m.question, 500), question: text(m.question, 500) })) };
        }).catch(() => null),
      ]);
      if (!localized) return res.json(data);
      const translated = new Map(localized.rows.map(row => [row.id, row]));
      return res.json({ ...data, q: localized.q || data.q, tags: localized.tags.length ? localized.tags : data.tags,
        rows: data.rows.map(row => ({ ...row, n: translated.get(row.id)?.n || row.n, question: translated.get(row.id)?.question || row.question })) });
    } catch (err) { return res.status(err.response?.status === 404 ? 404 : 503).json({ error: 'event_unavailable' }); }
  });
  router.get('/predict/history', limiter, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const token = req.query.token, range = req.query.range || '1w';
    if (typeof token !== 'string' || !TOKEN.test(token) || typeof range !== 'string' || !Object.hasOwn(RANGES, range)) return res.status(400).json({ error: 'invalid_history_request' });
    try {
      const data = await read(`history:${token}:${range}`, 'https://clob.polymarket.com/prices-history', { market: token, interval: range, fidelity: RANGES[range] }, raw => ({ history: normalizePredictionHistory(raw), fetchedAt: new Date(now()).toISOString() }));
      return res.json(data);
    } catch { return res.status(503).json({ error: 'history_unavailable' }); }
  });
}
