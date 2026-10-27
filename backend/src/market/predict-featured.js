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
