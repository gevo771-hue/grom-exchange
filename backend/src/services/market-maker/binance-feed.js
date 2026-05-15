import EventEmitter from 'node:events';
import WebSocket from 'ws';

export class BinanceBookTickerFeed extends EventEmitter {
  constructor({ pairs = [], wsUrl = 'wss://stream.binance.com:9443/ws', throttleMs = 200, logger = console } = {}) {
    super();
    this.pairs = pairs;
    this.wsUrl = wsUrl;
    this.throttleMs = throttleMs;
    this.logger = logger;
    this.ws = null;
    this.stopped = true;
    this.reconnectMs = 1000;
    this.lastTick = new Map();
  }

  start() {
    if (!this.pairs.length || !this.stopped) return;
    this.stopped = false;
    this.connect();
  }

  connect() {
    if (this.stopped) return;
    this.ws = new WebSocket(this.wsUrl);
    this.ws.on('open', () => {
      this.reconnectMs = 1000;
      const params = this.pairs.map((pair) => `${pair.binanceSymbol.toLowerCase()}@bookTicker`);
      this.ws.send(JSON.stringify({ method: 'SUBSCRIBE', params, id: Date.now() }));
      this.emit('connected');
    });
    this.ws.on('message', (raw) => this.handleMessage(raw));
    this.ws.on('error', (err) => this.logger.warn?.({ err: err.message }, 'mm binance ws error'));
    this.ws.on('close', () => this.reconnect());
  }

  reconnect() {
    if (this.stopped) return;
    const wait = this.reconnectMs;
    this.reconnectMs = Math.min(this.reconnectMs * 2, 30_000);
    setTimeout(() => this.connect(), wait).unref?.();
  }

  handleMessage(raw) {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg.s || !msg.b || !msg.a) return;
    const pairCfg = this.pairs.find((pair) => pair.binanceSymbol === msg.s);
    if (!pairCfg) return;
    const now = Date.now();
    if ((this.lastTick.get(pairCfg.pair) || 0) + this.throttleMs > now) return;
    this.lastTick.set(pairCfg.pair, now);
    this.emit('tick', {
      pair: pairCfg.pair,
      binanceSymbol: pairCfg.binanceSymbol,
      bid: Number(msg.b),
      ask: Number(msg.a),
      bidSize: Number(msg.B || 0),
      askSize: Number(msg.A || 0),
      ts: now,
    });
  }

  stop() {
    this.stopped = true;
    try { this.ws?.close(); } catch {}
    this.ws = null;
  }
}

export default BinanceBookTickerFeed;
