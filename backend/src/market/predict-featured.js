import { isCurrentPmEnd } from './predict-freshness.js';

const HOUR = 3600e3;
const DAY = 24 * HOUR;

/**
 * One category-diverse selection for every screen size.
 * Current events first (owner, 17.11: the home cards were stuck on long-running markets like
 * «2028 nominee»): markets that end within 12 h – 60 days and trade ≥ $50K today, by today's
 * volume; then any open market by today's volume, then by all-time volume.
 */
export function selectFeaturedPredictions(markets, count = 4, {
  now = Date.now(), exclude = new Set(), takenCats = new Set(),
  minLeftMs = 12 * HOUR, maxLeftMs = 60 * DAY, minVol24 = 50_000,
} = {}) {
  const alive = (markets || []).filter((m) => m && m.id != null && !exclude.has(String(m.id))
    && isCurrentPmEnd(m.endsAt, now));
  const left = (m) => {
    const t = Date.parse(m.endsAt || '');
    return Number.isFinite(t) ? t - now : Infinity;
  };
  const rank = (a, b) => (Number(b.vol24) || 0) - (Number(a.vol24) || 0)
    || (Number(b.vol) || 0) - (Number(a.vol) || 0) || String(a.id).localeCompare(String(b.id));
  const fresh = alive.filter((m) => left(m) >= minLeftMs && left(m) <= maxLeftMs && (Number(m.vol24) || 0) >= minVol24).sort(rank);
  const rest = alive.slice().sort(rank);
  const selected = [], ids = new Set(), categories = new Set(takenCats);
  function add(m) { selected.push(m); ids.add(String(m.id)); categories.add(m.cat); }
  for (const list of [fresh, rest]) {
    for (const m of list) {
      if (selected.length >= count) break;
      if (!ids.has(String(m.id)) && !categories.has(m.cat)) add(m);
    }
    for (const m of list) {
      if (selected.length >= count) break;
      if (!ids.has(String(m.id))) add(m);
    }
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

/**
 * One shared snapshot and coalesced cold load for all devices and languages.
 * The set of events is chosen once a day (`rotateMs`, owner 17.11); odds refresh every `ttl`.
 * An event that ended or left the catalog is replaced at once, without waiting for the day.
 */
export function createFeaturedPredictionLoader({ getCatalog, translate, now = Date.now, ttl = 90_000,
  rotateMs = DAY, count = 4 }) {
  let snapshot = null, pending = null, pick = null;
  function choose(all, t) {
    if (!pick || t - pick.at >= rotateMs) {
      const markets = selectFeaturedPredictions(all, count, { now: t });
      pick = { at: t, ids: markets.map((m) => String(m.id)) };
      return markets;
    }
    const byId = new Map((all || []).filter((m) => m && m.id != null).map((m) => [String(m.id), m]));
    let markets = pick.ids.map((id) => byId.get(id)).filter((m) => m && isCurrentPmEnd(m.endsAt, t));
    if (markets.length < count) {
      markets = markets.concat(selectFeaturedPredictions(all, count - markets.length, {
        now: t, exclude: new Set(markets.map((m) => String(m.id))), takenCats: new Set(markets.map((m) => m.cat)),
      }));
      pick = { at: pick.at, ids: markets.map((m) => String(m.id)) };
    }
    return markets;
  }
  async function canonical() {
    if (snapshot && now() - snapshot.at < ttl) return snapshot;
    if (pending) return pending;
    pending = (async () => {
      try {
        const catalog = await getCatalog();
        const markets = choose(catalog.markets, now());
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
