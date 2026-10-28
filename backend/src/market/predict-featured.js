import { isCurrentPmEnd } from './predict-freshness.js';

/** One category-diverse, volume-ranked selection for every screen size. */
export function selectFeaturedPredictions(markets, count = 4) {
  const ranked = (markets || []).filter((m) => m && m.id != null).slice().sort((a, b) =>
    (Number(b.vol) || 0) - (Number(a.vol) || 0) || String(a.id).localeCompare(String(b.id)));
  const selected = [], ids = new Set(), categories = new Set();
  function add(m) { selected.push(m); ids.add(String(m.id)); categories.add(m.cat); }
  for (const m of ranked) {
    if (selected.length >= count) break;
    if (!ids.has(String(m.id)) && !categories.has(m.cat)) add(m);
  }
  for (const m of ranked) {
    if (selected.length >= count) break;
    if (!ids.has(String(m.id))) add(m);
  }
  return selected;
}

/** Keep canonical IDs, order, categories, odds and token identities across locales. */
export function localizeFeaturedPredictions(selected, translated) {
  const byId = new Map((translated || []).map(m => [String(m.id), m]));
  return selected.map(m => {
    const local = byId.get(String(m.id));
    if (!local) return m;
    const rowLabels = new Map((local.rows || [])
      .filter(r => r.marketId != null).map(r => [String(r.marketId), r.n]));
    return { ...m, q: local.q || m.q, ends: local.ends || m.ends, time: local.time || m.time,
      rows: (m.rows || []).map(r => ({ ...r, n: rowLabels.get(String(r.marketId)) || r.n })) };
  });
}

/** One shared snapshot and coalesced cold load for all devices and languages. */
export function createFeaturedPredictionLoader({ getCatalog, translate, now = Date.now, ttl = 90_000 }) {
  let snapshot = null, pending = null;
  async function canonical() {
    if (snapshot && now() - snapshot.at < ttl) return snapshot;
    if (pending) return pending;
    pending = (async () => {
      try {
        const catalog = await getCatalog();
        const markets = selectFeaturedPredictions(catalog.markets);
        if (!markets.length) throw new Error('empty_featured_catalog');
        snapshot = { at: now(), catalog: { ...catalog, markets }, locales: new Map() };
        return snapshot;
      } catch (error) {
        if (snapshot && now() - snapshot.at < 20 * 60_000) return snapshot;
        throw error;
      } finally { pending = null; }
    })();
    return pending;
  }
  return async (locale = 'en') => {
    const current = await canonical();
    let markets = current.catalog.markets;
    if (locale !== 'en') {
      if (!current.locales.has(locale)) {
        // Only labels are accepted; a translation failure keeps the same events.
        current.locales.set(locale, Promise.resolve().then(() => translate(markets, locale))
          .then(rows => localizeFeaturedPredictions(markets, rows)).catch(() => markets));
      }
      markets = await current.locales.get(locale);
    }
    return { ...current.catalog, markets: markets.filter(m => isCurrentPmEnd(m.endsAt, now())), locale };
  };
}
