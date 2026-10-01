import rateLimit from 'express-rate-limit';

const YAHOO_SYMBOL_RE = /^[A-Z0-9][A-Z0-9.-]{0,19}$/;
const CHART_PRESETS = Object.freeze({ '1d': '5m', '5d': '15m', '1mo': '1d' });
const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 256;

export function setBoundedChartCacheEntry(cache, key, value, maxEntries = CACHE_MAX_ENTRIES) {
  cache.delete(key);
  while (cache.size >= maxEntries) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  cache.set(key, value);
}

export function getChartCacheEntry(cache, key, now = Date.now(), ttlMs = CACHE_TTL_MS) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (now - hit.ts >= ttlMs) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, hit);
  return hit.payload;
}

/** Resolve a chart request only to a ticker in the server's canonical xStock catalog. */
export function resolveXstocksChartRequest(query, catalog) {
  const symbol = String(query?.symbol || query?.sym || '').trim().toUpperCase();
  if (!symbol || symbol.length > 24 || !/^[A-Z0-9][A-Z0-9.-]*$/.test(symbol)) {
    return { error: 'symbol_required', status: 400 };
  }

  const item = Array.isArray(catalog)
    ? catalog.find((entry) => String(entry?.sym || '').trim().toUpperCase() === symbol)
    : null;
  if (!item) return { error: 'unknown_xstock', status: 404 };

  const range = String(query?.range || '5d');
  const expectedInterval = CHART_PRESETS[range];
  if (!expectedInterval) return { error: 'unsupported_chart_range', status: 400 };

  const interval = String(query?.interval || expectedInterval);
  if (interval !== expectedInterval) return { error: 'unsupported_chart_interval', status: 400 };

  const yahoo = String(item.yahooSym || '').trim().toUpperCase();
  if (!YAHOO_SYMBOL_RE.test(yahoo)) return { error: 'chart_unavailable', status: 503 };

  return { symbol, yahoo, range, interval };
}

function chartPayload(raw, request) {
  const result = raw?.chart?.result?.[0];
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
  const closes = result?.indicators?.quote?.[0]?.close || [];
  const points = [];
  for (let i = 0; i < Math.min(timestamps.length, closes.length, 400); i++) {
    const t = Number(timestamps[i]) * 1000;
    const c = Number(closes[i]);
    if (Number.isFinite(t) && t > 0 && Number.isFinite(c) && c > 0) points.push({ t, c });
  }
  const meta = result?.meta || {};
  const marketPrice = Number(meta.regularMarketPrice);
  return {
    symbol: request.symbol,
    yahoo: request.yahoo,
    range: request.range,
    interval: request.interval,
    currency: meta.currency || 'USD',
    points,
    last: points.length ? points[points.length - 1].c : (Number.isFinite(marketPrice) && marketPrice > 0 ? marketPrice : 0),
  };
}

/** Register a bounded, coalesced chart proxy. Dependencies are injectable for tests. */
export function registerXstocksChartRoute(router, {
  getCatalog,
  getSession,
  fetchChartData,
  maxCacheEntries = CACHE_MAX_ENTRIES,
} = {}) {
  if (typeof getCatalog !== 'function' || typeof fetchChartData !== 'function') {
    throw new TypeError('getCatalog and fetchChartData are required');
  }
  const cache = new Map();
  const inflight = new Map();
  const limiter = rateLimit({
    windowMs: 60_000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    message: { error: 'rate_limited' },
  });

  router.get('/xstocks/chart', limiter, async (req, res) => {
    try {
      const resolved = resolveXstocksChartRequest(req.query, await getCatalog());
      if (resolved.error) return res.status(resolved.status).json({ points: [], error: resolved.error });

      const key = `${resolved.symbol}|${resolved.yahoo}|${resolved.range}|${resolved.interval}`;
      const cached = getChartCacheEntry(cache, key);
      if (cached) {
        return res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=30').json(cached);
      }

      let pending = inflight.get(key);
      if (!pending) {
        pending = (async () => {
          let session = null;
          try { session = await getSession?.(); } catch (_) {}
          const raw = await fetchChartData({ ...resolved, session });
          const payload = chartPayload(raw, resolved);
          if (payload.points.length) setBoundedChartCacheEntry(cache, key, { ts: Date.now(), payload }, maxCacheEntries);
          return payload;
        })();
        inflight.set(key, pending);
      }
      try {
        const payload = await pending;
        return res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=30').json(payload);
      } finally {
        if (inflight.get(key) === pending) inflight.delete(key);
      }
    } catch (_) {
      return res.status(502).json({ points: [], error: 'chart_unavailable' });
    }
  });
  return router;
}
