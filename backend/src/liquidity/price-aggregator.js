/**
 * Price Aggregator — multi-source with failover.
 *
 * Sources are tried in the declared priority order. getPrice() returns the
 * price from the first healthy source. If the current primary goes stale or
 * diverges from the median by more than DIVERGENCE_BPS, we switch.
 *
 * DIVERGENCE_BPS = 50 (= 0.5%). Tunable.
 */
import logger from '../utils/logger.js';
import { metrics } from '../utils/metrics.js';

const DIVERGENCE_BPS = 50;

export class PriceAggregator {
  /** @param {Array<{name:string,getPrice:Function,getRecentCloses?:Function,isHealthy:Function}>} sources */
  constructor(sources) {
    this.sources = sources;    // declared in priority order
    this.activeIdx = 0;
  }

  async start() {
    for (const s of this.sources) {
      try { await s.start(); }
      catch (err) { logger.error({ err, source: s.name }, 'source start failed'); }
    }
  }

  _median(xs) {
    const v = xs.slice().sort((a, b) => a - b);
    if (v.length === 0) return null;
    const mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  }

  _bps(a, b) { return Math.abs((a - b) / b) * 10000; }

  async getPrice(asset) {
    // Collect all healthy source prices
    const quotes = this.sources
      .map(s => ({ name: s.name, price: s.getPrice(asset), healthy: s.isHealthy() }))
      .filter(q => q.price != null);

    if (quotes.length === 0) return null;

    const median = this._median(quotes.map(q => q.price));
    // Try active → fall through priority list
    for (let i = 0; i < this.sources.length; i++) {
      const s = this.sources[(this.activeIdx + i) % this.sources.length];
      const q = quotes.find(x => x.name === s.name);
      if (!q) continue;
      const diverges = this._bps(q.price, median) > DIVERGENCE_BPS;
      if (diverges && quotes.length > 1) {
        logger.warn({ asset, source: s.name, price: q.price, median }, 'price diverges, skipping');
        continue;
      }
      if ((this.activeIdx + i) % this.sources.length !== this.activeIdx) {
        const from = this.sources[this.activeIdx].name;
        this.activeIdx = (this.activeIdx + i) % this.sources.length;
        metrics.priceFeedFailover.inc({ from, to: s.name });
        logger.warn({ from, to: s.name, asset }, 'price feed failover');
      }
      return q.price;
    }
    // All diverged — return median as last resort
    return median;
  }

  async getRecentCloses(asset, n) {
    for (const s of this.sources) {
      if (!s.getRecentCloses) continue;
      const arr = s.getRecentCloses(asset, n);
      if (arr && arr.length >= Math.min(n, 30)) return arr;
    }
    return [];
  }

  health() {
    return this.sources.map(s => ({ name: s.name, healthy: s.isHealthy() }));
  }
}

export default PriceAggregator;
