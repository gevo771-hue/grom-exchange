import axios from 'axios';
import rateLimit from 'express-rate-limit';

const ID = /^[1-9][0-9]{0,19}$/;
const TOKEN = /^[0-9]{1,80}$/;
// Same public Data API v2 used by Polymarket charts. Long ranges choose their own resolution.
const RANGES = Object.freeze({ '1h': 60, '6h': 60, '1d': 300, '1w': 1800, '1m': null, max: null });
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
    const canonicalYes = outcomes.findIndex(v => /^(yes|up)$/i.test(String(v)));
    const canonicalNo = outcomes.findIndex(v => /^(no|down)$/i.test(String(v)));
    const binary = outcomes.length === 2 && outcomes.every(v => typeof v === 'string' && v.trim()) && outcomes[0] !== outcomes[1];
    const yes = canonicalYes >= 0 && canonicalNo >= 0 ? canonicalYes : 0;
    const no = canonicalYes >= 0 && canonicalNo >= 0 ? canonicalNo : 1;
    const py = binary ? price(prices[yes]) : null, pn = binary ? price(prices[no]) : null;
    const tokenYes = binary && TOKEN.test(String(tokens[yes] || '')) ? String(tokens[yes]) : '';
    const tokenNo = binary && TOKEN.test(String(tokens[no] || '')) ? String(tokens[no]) : '';
    const endsAt = date(m.endDate || raw.endDate);
    const closed = !!(raw.closed || raw.archived || m.closed || m.archived || (endsAt && Date.parse(endsAt) <= now));
    return {
      id: text(String(m.id || ''), 80), n: text(m.groupItemTitle || m.question || raw.title, 500),
      question: text(m.question, 500), description: text(m.description), resolutionSource: https(m.resolutionSource || raw.resolutionSource),
      p: py == null ? null : py * 100, pNo: pn == null ? null : pn * 100,
      labelYes: binary ? text(outcomes[yes], 160) : '', labelNo: binary ? text(outcomes[no], 160) : '',
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
      const data = await normalize(response.data);
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
      const url = 'https://data-api.polymarket.com/v2/prices-history';
      const params = { token_id: token, interval: range, ...(RANGES[range] ? { bucket_seconds: RANGES[range] } : {}) };
      const data = await read(`history-v2:${token}:${range}`, url, params, async first => {
        const points = [], cursors = new Set(), deadline = Date.now() + 20000;
        let page = first;
        for (let n = 0; n < 10; n++) {
          if (!Array.isArray(page?.data) || typeof page.pagination?.has_more !== 'boolean') throw new Error('invalid_history_page');
          points.push(...page.data);
          if (!page.pagination.has_more) {
            // Ignore old live ticks superseded by aggregate buckets, retaining the latest ticks.
            const lastBucket = points.reduce((last, p) => p?.resolution_seconds > 0 ? Math.max(last, number(p.timestamp) || 0) : last, 0);
            const history = normalizePredictionHistory({ history: points.filter(p => p?.resolution_seconds > 0 || number(p?.timestamp) > lastBucket)
              .map(p => ({ t: p.timestamp, p: p.price })) });
            return { history, fetchedAt: new Date(now()).toISOString(), source: 'Polymarket Data API v2' };
          }
          const cursor = page.pagination.next_cursor;
          if (n === 9 || !page.data.length || typeof cursor !== 'string' || !cursor || cursor.length > 2048 || cursors.has(cursor)) throw new Error('incomplete_history');
          cursors.add(cursor);
          const remaining = deadline - Date.now();
          if (remaining <= 0) throw new Error('history_timeout');
          const response = await get(url, { params: { ...params, cursor }, timeout: Math.min(12000, remaining), maxRedirects: 0, maxContentLength: 4000000, headers: { 'User-Agent': 'grom-exchange/1.0' } });
          page = response.data;
        }
        throw new Error('incomplete_history');
      });
      return res.json(data);
    } catch { return res.status(503).json({ error: 'history_unavailable' }); }
  });
}
