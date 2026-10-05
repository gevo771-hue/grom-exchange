/** Bounded parallel pagination. Never publish a silently incomplete catalog. */
export async function fetchXstocksCatalogPages(fetchPage, { concurrency = 4, maxPages = 24 } = {}) {
  const first = await fetchPage(0);
  if (!Array.isArray(first?.nodes)) throw new Error('Invalid xStocks catalog page');
  const all = first.nodes.slice();
  if (!first?.page?.hasNextPage) return all;
  for (let page = 1; page < maxPages; page += concurrency) {
    const pages = Array.from({ length: Math.min(concurrency, maxPages - page) }, (_, i) => page + i);
    const results = await Promise.allSettled(pages.map(fetchPage));
    for (const result of results) {
      if (result.status !== 'fulfilled') throw result.reason;
      const data = result.value;
      if (!Array.isArray(data?.nodes)) throw new Error('Invalid xStocks catalog page');
      all.push(...data.nodes);
      if (!data?.page?.hasNextPage) return all;
    }
  }
  throw new Error('xStocks catalog pagination limit reached');
}
