import WebSocket from 'ws';
import { EventEmitter } from 'node:events';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { metrics } from '../utils/metrics.js';

// Coinbase Advanced uses USD / USDT pairs; we normalise to USDT by assuming 1 USD ≈ 1 USDT fallback.
const MAP = {
  'BTC/USDT': 'BTC-USDT',
  'ETH/USDT': 'ETH-USDT',
  'SOL/USDT': 'SOL-USDT',
  'XRP/USDT': 'XRP-USDT',
};

export class CoinbaseSource extends EventEmitter {
  constructor({ assets }) {
    super();
    this.name = 'coinbase';
    this.assets = assets;
    this.prices = new Map();
    this.healthy = false;
    this.ws = null;
  }

  async start() { this._connect(); }

  _connect() {
    this.ws = new WebSocket(config.liquidity.coinbase.wsUrl);
    this.ws.on('open', () => {
      this.healthy = true;
      logger.info('coinbase ws connected');
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        product_ids: this.assets.map(a => MAP[a]).filter(Boolean),
        channels: ['ticker']
      }));
    });
    this.ws.on('message', (raw) => this._onMessage(raw));
    this.ws.on('close', () => {
      this.healthy = false;
      logger.warn('coinbase ws closed, reconnecting');
      setTimeout(() => this._connect(), 3000);
    });
    this.ws.on('error', (err) => logger.error({ err: err.message }, 'coinbase ws error'));
  }

  _onMessage(raw) {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.type !== 'ticker' || !msg.product_id) return;
    const asset = Object.keys(MAP).find(k => MAP[k] === msg.product_id);
    if (!asset) return;
    const price = parseFloat(msg.price);
    const ts = Date.now();
    this.prices.set(asset, { price, ts });
    metrics.priceFeedLatencyMs.labels('coinbase').observe(0);
    this.emit('tick', { source: 'coinbase', asset, price, ts });
  }

  getPrice(asset) {
    const e = this.prices.get(asset);
    if (!e || Date.now() - e.ts > 5000) return null;
    return e.price;
  }

  getRecentCloses() { return []; }
  isHealthy() { return this.healthy && this.prices.size > 0; }
}

export default CoinbaseSource;
