import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import { query, withTx } from '../../db/pool.js';
import { broadcastOrderbookSnapshot } from '../../spot/routes.js';
import BinanceBookTickerFeed from './binance-feed.js';
import BinanceRest from './binance-rest.js';
import MarketMakerState from './state.js';
import { assessKillSwitch, checkRisk } from './risk.js';
import { computeQuotes, shouldRequote } from './strategy.js';
import { setMarketMakerService } from './registry.js';

function nowKey() {
  return `${Date.now()}-${randomUUID()}`;
}

function splitPair(pair) {
  const [base, quote] = String(pair).split('/');
  return { base, quote };
}

function pairConfig(pair) {
  return config.mm.pairs.find((item) => item.pair === pair);
}

function quoteReservation(quote) {
  const { base, quote: quoteAsset } = splitPair(quote.pair);
  return {
    reservedAsset: quote.side === 'buy' ? quoteAsset : base,
    reservedAmount: quote.side === 'buy' ? quote.price * quote.size : quote.size,
  };
}

async function ensureMarketMakerUser() {
  await query(
    `INSERT INTO users (id, wallet_address, chain_id, kyc_status, role, created_at, last_seen_at)
     VALUES ($1, 'market-maker', 1, 'verified', 'market_maker', NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET role='market_maker', last_seen_at=NOW()`,
    [config.mm.userId]
  );
  const assets = new Set(['USDT']);
  for (const pair of config.mm.pairs) {
    const { base, quote } = splitPair(pair.pair);
    assets.add(base);
    assets.add(quote);
  }
  for (const asset of assets) {
    await query(
      `INSERT INTO balances (user_id, asset, mode, amount, locked, updated_at)
       VALUES ($1,$2,'live',$3,0,NOW())
       ON CONFLICT (user_id, asset, mode) DO NOTHING`,
      [config.mm.userId, asset, asset === 'USDT' ? 1_000_000 : 1_000]
    );
  }
}

export class MarketMakerService {
  constructor({ priceAggregator, wsBroadcaster, dbQuery = query } = {}) {
    this.priceAggregator = priceAggregator;
    this.wsBroadcaster = wsBroadcaster;
    this.query = dbQuery;
    this.state = new MarketMakerState({ dbQuery, logger });
    this.feed = new BinanceBookTickerFeed({
      pairs: config.mm.pairs,
      wsUrl: config.mm.binance.wsUrl,
      logger,
    });
    this.rest = new BinanceRest({
      apiKey: config.mm.binance.apiKey,
      apiSecret: config.mm.binance.apiSecret,
      baseUrl: config.mm.binance.restUrl,
      dryRun: config.mm.dryRun,
    });
    this.unsubOrders = null;
    this.tickTimers = new Map();
    this.latestTicks = new Map();
    this.lastRequoteAt = new Map();
    this.requoteInFlight = new Set();
    this.running = false;
  }

  token() {
    return jwt.sign({ sub: config.mm.userId, role: 'market_maker', addr: 'market-maker' }, config.auth.jwtSecret, { expiresIn: '1h' });
  }

  async start() {
    await ensureMarketMakerUser();
    try {
      await this.state.load();
    } catch (err) {
      if (err.code === '42P01') logger.warn('market maker tables missing; run migration 011 before enabling MM');
      else throw err;
    }
    this.unsubOrders = this.wsBroadcaster?.subscribeServer(`orders.user.${config.mm.userId}`, (event) => this.handleOrderEvent(event));
    this.feed.on('tick', (tick) => this.onTick(tick));
    if (config.mm.enabled) await this.enable('config_startup');
    setMarketMakerService(this);
    return this;
  }

  async enable(reason = 'manual') {
    if (this.running) return this.status();
    await this.state.load();
    this.running = true;
    this.state.enabled = true;
    this.feed.start();
    logger.info({ reason }, 'market maker enabled');
    return this.status();
  }

  async disable(reason = 'manual') {
    if (!this.running && !this.state.enabled) return this.status();
    this.running = false;
    this.state.enabled = false;
    this.feed.stop();
    for (const pair of config.mm.pairs.map((item) => item.pair)) await this.cancelPairQuotes(pair, reason);
    logger.warn({ reason }, 'market maker disabled');
    return this.status();
  }

  async stop() {
    await this.disable('shutdown');
    this.unsubOrders?.();
    setMarketMakerService(null);
  }

  async onTick(tick) {
    if (!this.running) return;
    const midPrice = (Number(tick.bid) + Number(tick.ask)) / 2;
    logger.debug({ pair: tick.pair, midPrice, bid: tick.bid, ask: tick.ask }, 'mm onTick');
    this.latestTicks.set(tick.pair, tick);

    const now = Date.now();
    const last = this.lastRequoteAt.get(tick.pair) || 0;
    const elapsed = now - last;
    if (elapsed >= config.mm.refreshMs && !this.requoteInFlight.has(tick.pair)) {
      await this.runRequote(tick);
      return;
    }

    if (this.tickTimers.has(tick.pair)) return;
    const delay = Math.max(config.mm.refreshMs - elapsed, 0);
    const timer = setTimeout(() => {
      this.tickTimers.delete(tick.pair);
      const latest = this.latestTicks.get(tick.pair);
      if (latest) void this.runRequote(latest);
    }, delay);
    timer.unref?.();
    this.tickTimers.set(tick.pair, timer);
  }

  async runRequote(tick) {
    if (this.requoteInFlight.has(tick.pair)) return;
    this.requoteInFlight.add(tick.pair);
    try {
      await this.requote(tick);
      this.lastRequoteAt.set(tick.pair, Date.now());
    } catch (err) {
      logger.warn({ err: err.stack || err.message, pair: tick.pair }, 'mm requote failed');
    } finally {
      this.requoteInFlight.delete(tick.pair);
    }
  }

  async requote(tick) {
    const cfg = pairConfig(tick.pair);
    if (!cfg || !this.running) return;
    const positions = Array.from(this.state.positions.values());
    const kill = assessKillSwitch({ positions, config: config.mm });
    if (kill.triggered) {
      await this.disable(kill.reason);
      return;
    }
    const midPrice = (Number(tick.bid) + Number(tick.ask)) / 2;
    const nextQuotes = computeQuotes({ midPrice, pair: tick.pair, config: cfg });
    const currentQuotes = this.state.getPairQuotes(tick.pair);
    logger.info({ pair: tick.pair, midPrice, nextQuotes: nextQuotes.length, currentQuotes: currentQuotes.length }, 'mm requote');
    if (!shouldRequote({ currentQuotes, newQuotes: nextQuotes, thresholdBps: config.mm.requoteThresholdBps })) {
      logger.debug({ pair: tick.pair }, 'mm requote skipped');
      return;
    }
    await this.cancelPairQuotes(tick.pair, 'requote');
    for (const quote of nextQuotes) await this.placeQuote(quote);
    await broadcastOrderbookSnapshot(this.wsBroadcaster, tick.pair);
  }

  async placeQuote(quote) {
    logger.info({ pair: quote.pair, side: quote.side, layer: quote.layer, price: quote.price, size: quote.size }, 'mm placeQuote');
    const reservation = quoteReservation(quote);
    const placed = await withTx(async (tx) => {
      const order = await tx.query(
        `INSERT INTO spot_orders
           (user_id, pair, side, type, price, amount, filled, status, reserved_asset, reserved_amount, client_order_id, updated_at)
         VALUES ($1,$2,$3,'limit',$4,$5,0,'open',$6,$7,$8,NOW())
         RETURNING *`,
        [config.mm.userId, quote.pair, quote.side, quote.price, quote.size, reservation.reservedAsset, reservation.reservedAmount, `mm:${quote.side}:${quote.layer}:${nowKey()}`]
      );
      const mmQuote = await tx.query(
        `INSERT INTO mm_quotes(pair, side, layer, price, size, order_id, status)
         VALUES ($1,$2,$3,$4,$5,$6,'placed')
         RETURNING *`,
        [quote.pair, quote.side, quote.layer, quote.price, quote.size, order.rows[0].id]
      );
      return mmQuote.rows[0];
    });
    this.state.setQuote(placed);
    return placed;
  }

  async cancelPairQuotes(pair, reason = 'cancel') {
    const quotes = this.state.getPairQuotes(pair);
    if (!quotes.length) return;
    const orderIds = quotes.map((quote) => quote.order_id).filter(Boolean);
    if (orderIds.length) {
      await this.query(
        `UPDATE spot_orders
            SET status='cancelled', reserved_amount=0, cancelled_at=NOW(), updated_at=NOW()
          WHERE user_id=$1 AND id = ANY($2::uuid[]) AND status IN ('open','partial')`,
        [config.mm.userId, orderIds]
      );
      await this.query(
        `UPDATE mm_quotes
            SET status='cancelled', updated_at=NOW()
          WHERE order_id = ANY($1::uuid[]) AND status IN ('placed','partial')`,
        [orderIds]
      );
    }
    this.state.clearPairQuotes(pair);
    await broadcastOrderbookSnapshot(this.wsBroadcaster, pair);
    logger.debug({ pair, reason, count: orderIds.length }, 'mm quotes cancelled');
  }

  async handleOrderEvent(event) {
    const data = event?.data || {};
    if (!['spot_order_filled', 'spot_order_partial'].includes(data.event)) return;
    const order = data.order;
    if (!order?.id) return;
    const { rows } = await this.query(`SELECT * FROM mm_quotes WHERE order_id=$1 LIMIT 1`, [order.id]);
    const quote = rows[0];
    if (!quote) return;
    const filled = Number(order.filled || 0);
    const prevFilled = Number(quote.filled_size || 0);
    const delta = Math.max(filled - prevFilled, 0);
    if (delta <= 0) return;

    await this.query(
      `UPDATE mm_quotes
          SET filled_size=$2, status=$3, updated_at=NOW()
        WHERE id=$1`,
      [quote.id, filled, order.status === 'filled' ? 'filled' : 'partial']
    );
    await this.hedgeFill({ quote, order, fillSize: delta });
  }

  async hedgeFill({ quote, order, fillSize }) {
    const cfg = pairConfig(quote.pair);
    const binanceSide = quote.side === 'sell' ? 'BUY' : 'SELL';
    const hedgeSign = binanceSide === 'BUY' ? 1 : -1;
    const exposureSign = quote.side === 'buy' ? 1 : -1;
    const position = this.state.getPosition(quote.pair);
    const risk = checkRisk({
      pair: quote.pair,
      side: quote.side,
      size: fillSize,
      currentPosition: position,
      config: { ...cfg, maxDrawdownUsdt: config.mm.maxTotalDrawdownUsdt },
      hedgeHealth: this.state.hedgeHealth,
    });
    if (!risk.ok) {
      logger.error({ risk, pair: quote.pair }, 'mm hedge risk rejected');
      await this.disable(risk.reason);
      return;
    }
    const result = await this.rest.placeMarketOrder({
      symbol: cfg.binanceSymbol,
      side: binanceSide,
      quantity: fillSize,
    });
    await this.query(
      `INSERT INTO mm_hedges(trigger_order_id, pair, side, size, price, binance_order_id, binance_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [order.id, quote.pair, binanceSide.toLowerCase(), fillSize, order.avg_fill_price || order.price || quote.price, String(result.orderId || ''), result.status || 'submitted']
    );
    await this.state.upsertPosition({
      pair: quote.pair,
      netDelta: exposureSign * fillSize,
      hedgeDelta: hedgeSign * fillSize,
      price: order.avg_fill_price || order.price || quote.price,
    });
  }

  async updatePair(pair, patch) {
    await this.query(
      `INSERT INTO mm_pair_settings(pair, spread_bps, size_base, max_position_base, updated_at)
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT(pair)
       DO UPDATE SET spread_bps=EXCLUDED.spread_bps, size_base=EXCLUDED.size_base, max_position_base=EXCLUDED.max_position_base, updated_at=NOW()`,
      [pair, patch.spreadBps ?? null, patch.sizeBase ?? null, patch.maxPositionBase ?? null]
    );
    const cfg = pairConfig(pair);
    if (cfg) {
      if (patch.spreadBps !== undefined) cfg.spreadBps = patch.spreadBps;
      if (patch.sizeBase !== undefined) cfg.sizeBase = patch.sizeBase;
      if (patch.maxPositionBase !== undefined) cfg.maxPositionBase = patch.maxPositionBase;
    }
    return cfg;
  }

  async recentHedges(limit = 50) {
    const { rows } = await this.query(
      `SELECT * FROM mm_hedges ORDER BY executed_at DESC LIMIT $1`,
      [limit]
    );
    return rows;
  }

  status() {
    return {
      ...this.state.status(),
      configured: config.mm.enabled,
      dryRun: config.mm.dryRun,
      pairs: config.mm.pairs.map((pair) => ({
        ...pair,
        activeQuotes: this.state.getPairQuotes(pair.pair).length,
      })),
    };
  }
}

export async function startMarketMaker(opts) {
  const service = new MarketMakerService(opts);
  return service.start();
}

export default startMarketMaker;
