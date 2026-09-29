/**
 * DefiLlama reference prices — secondary neutral feed (not for settlement).
 */
import { EventEmitter } from 'node:events';
import axios from 'axios';
import logger from '../utils/logger.js';

const COIN_MAP = {
  'BTC/USDT': 'coingecko:bitcoin',
  'ETH/USDT': 'coingecko:ethereum',
  'SOL/USDT': 'coingecko:solana',
  'XRP/USDT': 'coingecko:ripple',
  'BNB/USDT': 'coingecko:binancecoin',
};

const STALE_MS = 90_000;
const POLL_MS = 30_000;

export class DefiLlamaSource extends EventEmitter {
  constructor({ assets }) {
    super();
    this.name = 'defillama';
    this.assets = assets || Object.keys(COIN_MAP);
    this.prices = new Map();
    this.candles = new Map();
    this.healthy = false;
    this._timer = null;
  }

  async start() {
    await this._poll();
    this._timer = setInterval(() => {
      this._poll().catch((err) => logger.warn({ err: err.message }, 'defillama poll'));
    }, POLL_MS);
    if (this._timer.unref) this._timer.unref();
  }

  async stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  async _poll() {
    const coins = [...new Set(this.assets.map((a) => COIN_MAP[a]).filter(Boolean))];
    if (!coins.length) return;
    const { data } = await axios.get(`https://coins.llama.fi/prices/current/${coins.join(',')}`, {
      timeout: 12_000,
      headers: { Accept: 'application/json', 'User-Agent': 'grom-exchange/1.0' },
    });
    const ts = Date.now();
    for (const asset of this.assets) {
      const key = COIN_MAP[asset];
      const price = Number(data?.coins?.[key]?.price);
      if (!Number.isFinite(price) || price <= 0) continue;
      this.prices.set(asset, { price, ts });
      const arr = this.candles.get(asset) || [];
      arr.push(price);
      while (arr.length > 500) arr.shift();
      this.candles.set(asset, arr);
      this.emit('tick', { source: 'defillama', asset, price, ts });
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

export default DefiLlamaSource;
