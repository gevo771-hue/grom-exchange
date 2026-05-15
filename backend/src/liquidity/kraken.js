import WebSocket from 'ws';
import { EventEmitter } from 'node:events';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { metrics } from '../utils/metrics.js';

// Kraken uses BTC → XBT and different naming
const MAP = {
  'BTC/USDT': 'BTC/USDT',
  'ETH/USDT': 'ETH/USDT',
  'SOL/USDT': 'SOL/USDT',
  'XRP/USDT': 'XRP/USDT',
};

export class KrakenSource extends EventEmitter {
  constructor({ assets }) {
    super();
    this.name = 'kraken';
    this.assets = assets;
    this.prices = new Map();
    this.healthy = false;
    this.ws = null;
  }

  async start() {
    this._connect();
  }

  _connect() {
    this.ws = new WebSocket(config.liquidity.kraken.wsUrl);
    this.ws.on('open', () => {
      this.healthy = true;
      logger.info('kraken ws connected');
      this.ws.send(JSON.stringify({
        method: 'subscribe',
        params: { channel: 'ticker', symbol: this.assets.map(a => MAP[a]).filter(Boolean) }
      }));
    });
    this.ws.on('message', (raw) => this._onMessage(raw));
    this.ws.on('close', () => {
      this.healthy = false;
      logger.warn('kraken ws closed, reconnecting');
      setTimeout(() => this._connect(), 3000);
    });
    this.ws.on('error', (err) => logger.error({ err: err.message }, 'kraken ws error'));
  }

  _onMessage(raw) {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.channel !== 'ticker' || !Array.isArray(msg.data)) return;
    for (const d of msg.data) {
      const asset = Object.keys(MAP).find(k => MAP[k] === d.symbol);
      if (!asset) continue;
      const price = parseFloat(d.last);
      const ts = Date.now();
      this.prices.set(asset, { price, ts });
      metrics.priceFeedLatencyMs.labels('kraken').observe(0);
      this.emit('tick', { source: 'kraken', asset, price, ts });
    }
  }

  getPrice(asset) {
    const e = this.prices.get(asset);
    if (!e || Date.now() - e.ts > 5000) return null;
    return e.price;
  }

  getRecentCloses() { return []; }     // Kraken kline via REST if needed — out of scope for fallback

  isHealthy() { return this.healthy && this.prices.size > 0; }
}

export default KrakenSource;
