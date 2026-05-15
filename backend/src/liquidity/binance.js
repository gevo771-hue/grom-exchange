/**
 * Binance price feed — spot public streams. No auth required for tick data.
 * For order execution (future: spot order-routing), the signed REST endpoints
 * will need GROM_BINANCE_API_KEY/SECRET from config.
 */
import WebSocket from 'ws';
import { EventEmitter } from 'node:events';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { metrics } from '../utils/metrics.js';

const SYMBOL_MAP = {
  'BTC/USDT': 'btcusdt',
  'ETH/USDT': 'ethusdt',
  'SOL/USDT': 'solusdt',
  'XRP/USDT': 'xrpusdt',
  'BNB/USDT': 'bnbusdt',
};

export class BinanceSource extends EventEmitter {
  constructor({ assets }) {
    super();
    this.name = 'binance';
    this.assets = assets;
    this.prices = new Map();       // asset -> { price, ts }
    this.candles = new Map();      // asset -> number[] (1m closes)
    this.healthy = false;
    this.ws = null;
    this.reconnectAttempts = 0;
  }

  async start() {
    const streams = this.assets.map(a => `${SYMBOL_MAP[a]}@trade/${SYMBOL_MAP[a]}@kline_1m`).join('/');
    const url = `${config.liquidity.binance.wsUrl.replace('/ws','/stream')}?streams=${streams}`;
    this._connect(url);
  }

  _connect(url) {
    this.ws = new WebSocket(url);
    this.ws.on('open', () => {
      logger.info('binance ws connected');
      this.healthy = true;
      this.reconnectAttempts = 0;
    });
    this.ws.on('message', (raw) => this._onMessage(raw));
    this.ws.on('close', () => {
      this.healthy = false;
      this.reconnectAttempts++;
      const backoff = Math.min(30_000, 500 * 2 ** this.reconnectAttempts);
      logger.warn({ backoff }, 'binance ws closed, reconnecting');
      setTimeout(() => this._connect(url), backoff);
    });
    this.ws.on('error', (err) => {
      logger.error({ err: err.message }, 'binance ws error');
    });
  }

  _onMessage(raw) {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const data = msg.data || msg;
    const stream = msg.stream || '';
    const asset = Object.entries(SYMBOL_MAP).find(([, s]) => stream.startsWith(s))?.[0];
    if (!asset) return;

    if (stream.endsWith('@trade') && data.p) {
      const price = parseFloat(data.p);
      const ts = data.T || Date.now();
      this.prices.set(asset, { price, ts });
      metrics.priceFeedLatencyMs.labels('binance').observe(Date.now() - ts);
      this.emit('tick', { source: 'binance', asset, price, ts });
    } else if (stream.endsWith('@kline_1m') && data.k?.x) {
      // 'x' = is_closed
      const close = parseFloat(data.k.c);
      const arr = this.candles.get(asset) || [];
      arr.push(close);
      while (arr.length > 500) arr.shift();
      this.candles.set(asset, arr);
    }
  }

  getPrice(asset) {
    const entry = this.prices.get(asset);
    if (!entry) return null;
    if (Date.now() - entry.ts > 5000) return null;  // stale guard
    return entry.price;
  }

  getRecentCloses(asset, n) { return (this.candles.get(asset) || []).slice(-n); }

  isHealthy() { return this.healthy && this.prices.size > 0; }
}

export default BinanceSource;
