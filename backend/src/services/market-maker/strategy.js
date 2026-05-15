function roundPrice(value) {
  return Number(Number(value).toFixed(8));
}

export function computeQuotes({ midPrice, pair, config }) {
  const mid = Number(midPrice);
  if (!Number.isFinite(mid) || mid <= 0) return [];
  const spreadHalf = Number(config.spreadBps || 0) / 2;
  const offsets = config.layerOffsetsBps || [10, 40];
  const multipliers = config.layerSizeMultipliers || [1, 2.5];
  const sizeBase = Number(config.sizeBase || 0);
  const quotes = [];

  const firstOffset = Number(offsets[0] || 0);
  offsets.forEach((offset, index) => {
    const layer = index + 1;
    const size = Number((sizeBase * Number(multipliers[index] || 1)).toFixed(8));
    const distanceBps = spreadHalf + Number(offset || 0) - firstOffset / 2;
    quotes.push({
      pair,
      side: 'buy',
      layer,
      price: roundPrice(mid * (1 - distanceBps / 10_000)),
      size,
    });
    quotes.push({
      pair,
      side: 'sell',
      layer,
      price: roundPrice(mid * (1 + distanceBps / 10_000)),
      size,
    });
  });

  return quotes.sort((a, b) => a.side.localeCompare(b.side) || a.layer - b.layer);
}

export function shouldRequote({ currentQuotes = [], newQuotes = [], thresholdBps = 5 }) {
  if (currentQuotes.length !== newQuotes.length) return true;
  const byKey = new Map(currentQuotes.map((quote) => [`${quote.side}:${quote.layer}`, quote]));
  for (const next of newQuotes) {
    const current = byKey.get(`${next.side}:${next.layer}`);
    if (!current) return true;
    const price = Number(current.price);
    if (!price) return true;
    const driftBps = Math.abs((Number(next.price) - price) / price) * 10_000;
    if (driftBps > thresholdBps) return true;
  }
  return false;
}

export default { computeQuotes, shouldRequote };
