/**
 * CoinGecko reference price feed.
 * Polls simple/price — NOT used for swap settlement (DEX quotes only).
 */
import { EventEmitter } from 'node:events';
import axios from 'axios';
import logger from '../utils/logger.js';
import { metrics } from '../utils/metrics.js';

const ID_MAP = {
  'BTC/USDT': 'bitcoin',
  'ETH/USDT': 'ethereum',
  'SOL/USDT': 'solana',
  'XRP/USDT': 'ripple',
  'BNB/USDT': 'binancecoin',
};

const STALE_MS = 60_000;
const POLL_MS = 20_000;

export class CoinGeckoSource extends EventEmitter {
  constructor({ assets }) {
    super();
    this.name = 'coingecko';
    this.assets = assets || Object.keys(ID_MAP);
    this.prices = new Map();
    this.candles = new Map();
    this.healthy = false;
    this._timer = null;
    this._ids = [...new Set(this.assets.map((a) => ID_MAP[a]).filter(Boolean))];
  }

  async start() {
    await this._poll();
    this._timer = setInterval(() => {
      this._poll().catch((err) => logger.warn({ err: err.message }, 'coingecko poll'));
    }, POLL_MS);
    if (this._timer.unref) this._timer.unref();
  }

  async stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  async _poll() {
    if (!this._ids.length) return;
    const headers = { Accept: 'application/json', 'User-Agent': 'grom-exchange/1.0' };
    const key = String(process.env.COINGECKO_API_KEY || process.env.GROM_COINGECKO_API_KEY || '').trim();
    if (key) headers['x-cg-pro-api-key'] = key;
    const base = key
      ? 'https://pro-api.coingecko.com/api/v3'
      : 'https://api.coingecko.com/api/v3';
    const { data } = await axios.get(`${base}/simple/price`, {
      params: {
        ids: this._ids.join(','),
        vs_currencies: 'usd',
      },
      timeout: 12_000,
      headers,
    });
    const ts = Date.now();
    for (const asset of this.assets) {
      const id = ID_MAP[asset];
      const price = Number(data?.[id]?.usd);
      if (!Number.isFinite(price) || price <= 0) continue;
      this.prices.set(asset, { price, ts });
      const arr = this.candles.get(asset) || [];
      arr.push(price);
      while (arr.length > 500) arr.shift();
      this.candles.set(asset, arr);
      metrics.priceFeedLatencyMs.labels('coingecko').observe(0);
      this.emit('tick', { source: 'coingecko', asset, price, ts });
    }
    this.healthy = this.prices.size > 0;
  }

  getPrice(asset) {
    const entry = this.prices.get(asset);
    if (!entry) return null;
    if (Date.now() - entry.ts > STALE_MS) return null;
    return entry.price;
  }

  getRecentCloses(asset, n) {
    return (this.candles.get(asset) || []).slice(-n);
  }

  isHealthy() {
    return this.healthy && this.prices.size > 0;
  }
}

export default CoinGeckoSource;
