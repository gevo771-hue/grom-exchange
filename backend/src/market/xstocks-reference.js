import rateLimit from 'express-rate-limit';

const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 256;

export function currentXstockMultiplier(data, now = Date.now()) {
  const current = Number(data?.currentMultiplier);
  const next = Number(data?.newMultiplier);
  const rawActivation = Number(data?.activationDateTime);
  const activationMs = rawActivation > 1e12 ? rawActivation : rawActivation * 1000;
  if (Number.isFinite(next) && next > 0 && Number.isFinite(activationMs)
      && activationMs > 0 && activationMs <= now) return next;
  return Number.isFinite(current) && current > 0 ? current : null;
}

export function resolveXstockReferenceRequest(query, catalog) {
  const raw = String(query?.symbol || query?.sym || '').trim();
  if (!raw || raw.length > 32 || !/^[A-Z0-9][A-Z0-9.-]*$/i.test(raw)) {
    return { error: 'symbol_required', status: 400 };
  }
  const symbol = raw.toUpperCase();
  const item = Array.isArray(catalog)
    ? catalog.find((entry) => [entry?.sym, entry?.tokenSym]
      .some((candidate) => String(candidate || '').trim().toUpperCase() === symbol))
    : null;
  if (!item) return { error: 'unknown_xstock', status: 404 };
  const tokenSym = String(item.tokenSym || '').trim();
  if (!/^[A-Z0-9][A-Z0-9.-]*X$/i.test(tokenSym)) {
    return { error: 'reference_unavailable', status: 503 };
  }
  return { symbol: String(item.sym || '').toUpperCase(), tokenSym, item };
}

export function registerXstocksReferenceRoute(router, {
  getCatalog,
  fetchPriceData,
  fetchMultiplier,
  now = Date.now,
  maxCacheEntries = CACHE_MAX_ENTRIES,
  ttlMs = CACHE_TTL_MS,
} = {}) {
  if (typeof getCatalog !== 'function' || typeof fetchPriceData !== 'function') {
    throw new TypeError('getCatalog and fetchPriceData are required');
  }

  const cache = new Map();
  const inflight = new Map();
  const limiter = rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    message: { error: 'rate_limited' },
  });

  router.get('/xstocks/reference-price', limiter, async (req, res) => {
    try {
      const resolved = resolveXstockReferenceRequest(req.query, await getCatalog());
      if (resolved.error) return res.status(resolved.status).json({ error: resolved.error });

      const cached = cache.get(resolved.symbol);
      if (cached && now() - cached.ts < ttlMs) {
        return res.set('Cache-Control', 'public, max-age=30').json(cached.payload);
      }

      let pending = inflight.get(resolved.symbol);
      if (!pending) {
        pending = (async () => {
          const item = resolved.item;
          const jobs = [Promise.resolve().then(() => fetchPriceData({ tokenSym: resolved.tokenSym }))];
          if (item.solMint && typeof fetchMultiplier === 'function') {
            jobs.push(Promise.resolve().then(() => fetchMultiplier({ tokenSym: resolved.tokenSym, network: 'Solana' })));
          } else {
            jobs.push(Promise.resolve(null));
          }
          const [priceResult, multiplierResult] = await Promise.allSettled(jobs);
          const quote = priceResult.status === 'fulfilled' ? Number(priceResult.value?.quote) : 0;
          const yahooAt = Number(item.fairPriceAt) || 0;
          const yahooFallback = yahooAt > 0 && now() - yahooAt < 5 * 60_000
            ? Number(item.fairPrice)
            : 0;
          const official = Number.isFinite(quote) && quote > 0 && quote < 1e9 ? quote : 0;
          const fallback = Number.isFinite(yahooFallback) && yahooFallback > 0 && yahooFallback < 1e9
            ? yahooFallback
            : 0;
          const multiplierData = multiplierResult.status === 'fulfilled' ? multiplierResult.value : null;
          const solMultiplier = item.solMint ? currentXstockMultiplier(multiplierData, now()) : null;
          const payload = {
            symbol: resolved.symbol,
            fairPrice: official || fallback,
            fairPriceSource: official ? 'xstocks' : (fallback ? 'yahoo-usd' : null),
            solMultiplier,
            fetchedAt: now(),
          };
          if (!(payload.fairPrice > 0) && !payload.solMultiplier) {
            throw new Error('reference_unavailable');
          }
          while (cache.size >= maxCacheEntries) cache.delete(cache.keys().next().value);
          cache.set(resolved.symbol, { ts: now(), payload });
          return payload;
        })();
        inflight.set(resolved.symbol, pending);
      }
      try {
        const payload = await pending;
        return res.set('Cache-Control', 'public, max-age=30').json(payload);
      } finally {
        if (inflight.get(resolved.symbol) === pending) inflight.delete(resolved.symbol);
      }
    } catch (_) {
      return res.status(503).json({ error: 'reference_unavailable' });
    }
  });
  return router;
}
