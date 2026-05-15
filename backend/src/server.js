/**
 * GROM Exchange — backend entrypoint.
 *   - Express HTTP (auth, binary, spot scaffold, metrics)
 *   - WebSocket (binary rounds, live prices)
 *   - Binary options engine
 *   - Price aggregator (Binance → Kraken → Coinbase failover)
 */
import http from 'node:http';
import express from 'express';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';

import config from './config/index.js';
import logger from './utils/logger.js';
import { metrics, registry } from './utils/metrics.js';
import { pool } from './db/pool.js';
import { closeSentry, initSentry, sentryErrorMiddleware, sentryRequestMiddleware } from './utils/sentry.js';
import geoBlockMiddleware from './middleware/geo-block.js';
import maintenanceMiddleware from './middleware/maintenance.js';
import { marketGate } from './middleware/market-control.js';

import createAuthRouter, { requireAuth } from './wallet/siwe.js';
import createWalletRouter from './wallet/routes.js';
import startWithdrawalQueueWorker from './wallet/queue-worker.js';
import startNotificationsWorker from './notifications/worker.js';
import createSpotRouter from './spot/routes.js';
import startSpotStopWorker from './spot/stop-worker.js';
import createBinaryRouter from './binary/routes.js';
import createMarketRouter from './market/routes.js';
import createFuturesRouter from './futures/routes.js';
import startFuturesMarkLoop from './futures/mark-loop.js';
import startFuturesFundingLoop from './futures/funding-loop.js';
import startMarketMaker from './services/market-maker/index.js';
import createSettingsRouter from './settings/routes.js';
import createSessionsRouter from './sessions/routes.js';
import createReferralRouter from './referral/routes.js';
import createApiKeysRouter from './apikeys/routes.js';
import createSupportRouter from './support/routes.js';
import createAdminRouter from './admin/routes.js';
import createKycRouter from './kyc/routes.js';
import createOnrampRouter from './onramp/routes.js';
import BinaryEngine from './binary/engine.js';
import createWsBroadcaster from './binary/ws.js';
import startBinanceConfirmWatcher from './wallet/binance-confirmation-watcher.js';
import startBinanceDepositReconciler from './wallet/binance-deposit-reconciler.js';
import { binance as binanceClient } from './integrations/binance/client.js';
import { supportedBinanceNetworkPairs } from './integrations/binance/network-map.js';

import BinanceSource from './liquidity/binance.js';
import KrakenSource  from './liquidity/kraken.js';
import CoinbaseSource from './liquidity/coinbase.js';
import PriceAggregator from './liquidity/price-aggregator.js';
import DexAggregator from './liquidity/dex-aggregator.js';

// Minimal inline CORS to avoid an extra dep.
const corsMw = (req, res, next) => {
  res.header('Access-Control-Allow-Origin', config.cors.origin);
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
};

function normaliseSseChannels(channels, userId) {
  const requested = String(channels || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const defaults = ['balances', 'orders', 'positions', 'notifications'];
  return (requested.length ? requested : defaults).map((channel) => {
    if (channel.includes('.')) return channel;
    if (['balances', 'orders', 'positions', 'notifications'].includes(channel)) {
      return `${channel}.user.${userId}`;
    }
    return channel;
  });
}

function attachSseRoute(app, ws) {
  app.get('/api/stream/sse', (req, res) => {
    const token = String(req.query.token || '').trim();
    if (!token) return res.status(401).json({ error: 'token_required' });

    let user;
    try {
      user = jwt.verify(token, config.auth.jwtSecret);
    } catch {
      return res.status(401).json({ error: 'invalid_token' });
    }

    const channels = normaliseSseChannels(req.query.channels, user.sub);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(`event: ready\ndata: ${JSON.stringify({ channels })}\n\n`);

    const unsubs = channels.map((channel) => ws.subscribeServer(channel, (event) => {
      res.write(`event: message\ndata: ${JSON.stringify(event)}\n\n`);
    }));
    const heartbeat = setInterval(() => res.write(`event: heartbeat\ndata: ${Date.now()}\n\n`), 30_000);
    heartbeat.unref?.();

    req.on('close', () => {
      clearInterval(heartbeat);
      for (const unsub of unsubs) unsub();
    });
  });
}

async function main() {
  initSentry();
  const app = express();
  app.set('trust proxy', true);
  app.use(helmet());
  app.use(corsMw);
  app.use(express.json({
    limit: '64kb',
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  }));
  app.use(sentryRequestMiddleware());
  app.use(maintenanceMiddleware());

  // Metrics per request
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      metrics.httpRequests.inc({ method: req.method, route: req.route?.path || req.path, status: res.statusCode });
    });
    next();
  });

  // Liquidity
  const assets = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT'];
  const binance  = new BinanceSource({ assets });
  const kraken   = new KrakenSource({ assets });
  const coinbase = new CoinbaseSource({ assets });
  const priceAggregator = new PriceAggregator([binance, kraken, coinbase]);
  const dex = new DexAggregator();
  await priceAggregator.start();

  // WS + HTTP share the same server to reuse port
  const server = http.createServer(app);
  const ws = createWsBroadcaster(server);

  // Broadcast every tick at most 5× per second per asset
  const throttle = new Map();
  for (const s of [binance, kraken, coinbase]) {
    s.on('tick', ({ asset, price, ts }) => {
      const key = asset;
      const now = Date.now();
      if ((throttle.get(key) || 0) + 200 > now) return;
      throttle.set(key, now);
      ws.broadcast(`price:${asset}`, { asset, price, ts, source: s.name });
      ws.broadcast(`prices.${asset}`, { asset, price, ts, source: s.name });
    });
  }

  // Binary engine
  const engine = new BinaryEngine({ priceAggregator, wsBroadcaster: ws });
  await engine.start();
  const withdrawalWorker = startWithdrawalQueueWorker();
  const notificationsWorker = startNotificationsWorker({ wsBroadcaster: ws });
  const spotStopWorker = startSpotStopWorker({ priceAggregator, wsBroadcaster: ws });
  const futuresMarkLoop = startFuturesMarkLoop({ priceAggregator, wsBroadcaster: ws });
  const futuresFundingLoop = startFuturesFundingLoop({ priceAggregator, wsBroadcaster: ws });
  const marketMaker = await startMarketMaker({ priceAggregator, wsBroadcaster: ws });
  const binanceHealth = config.binance.useAsHotWallet ? binanceClient.startHealthCheck() : null;
  const binanceConfirmWatcher = config.binance.useAsHotWallet ? startBinanceConfirmWatcher() : null;
  const binanceDepositReconciler = config.binance.useAsHotWallet ? startBinanceDepositReconciler({ wsBroadcaster: ws }) : null;

  app.get('/api/config', (_req, res) => {
    res.json({
      payout: config.binary.payout,
      durations: config.binary.durations,
      assets,
      devLogin: Boolean(config.allowDevLogin),
      sentry: { publicDsn: config.sentry.publicDsn },
      sentryPublicDsn: config.sentry.publicDsn,
    });
  });
  app.get('/api/config/networks', (_req, res) => {
    res.json({
      mode: config.binance.useAsHotWallet ? 'binance' : 'native_signers',
      networks: supportedBinanceNetworkPairs(),
    });
  });

  // Routes
  app.get('/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({
        status: 'ok',
        env: config.env,
        price_sources: priceAggregator.health(),
        dev_login: Boolean(config.allowDevLogin),
      });
    } catch (err) {
      res.status(503).json({ status: 'degraded', error: err.message });
    }
  });

  app.get('/metrics', async (_req, res) => {
    res.setHeader('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });

  app.use('/auth', geoBlockMiddleware(), createAuthRouter());
  app.use('/api/market', createMarketRouter());
  app.use('/api', geoBlockMiddleware(), createWalletRouter({ requireAuth, priceAggregator, wsBroadcaster: ws }));
  app.use('/api/spot', marketGate('spot'), createSpotRouter({ requireAuth, priceAggregator, wsBroadcaster: ws }));
  app.use('/api/futures', marketGate('futures'), createFuturesRouter({ requireAuth, priceAggregator, wsBroadcaster: ws }));
  app.use('/api/binary', marketGate('binary'), createBinaryRouter({ engine, requireAuth, priceAggregator }));
  app.use('/api/settings', createSettingsRouter({ requireAuth }));
  app.use('/api/sessions', createSessionsRouter({ requireAuth }));
  app.use('/api/referral', createReferralRouter({ requireAuth }));
  app.use('/api/apikeys',  createApiKeysRouter({ requireAuth }));
  app.use('/api/support',  createSupportRouter({ requireAuth }));
  app.use('/api/kyc',      createKycRouter({ requireAuth }));
  app.use('/api/onramp',   createOnrampRouter({ requireAuth, wsBroadcaster: ws }));
  app.use('/api/admin',    createAdminRouter({ requireAuth }));
  attachSseRoute(app, ws);

  // DEX quote
  app.post('/api/swap/quote', requireAuth, async (req, res, next) => {
    try {
      const { chainId, src, dst, amount, userAddress } = req.body || {};
      if (!chainId || !src || !dst || !amount) return res.status(400).json({ error: 'bad params' });
      const quote = await dex.quote({ chainId, src, dst, amount, userAddress });
      res.json(quote);
    } catch (err) { next(err); }
  });

  app.use(sentryErrorMiddleware());
  app.use((err, _req, res, _next) => {
    logger.error({ err: err.stack || err.message }, 'unhandled');
    res.status(500).json({ error: 'internal' });
  });

  server.listen(config.ports.backend, () => {
    logger.info({ port: config.ports.backend }, 'GROM backend listening');
  });

  const shutdown = async () => {
    logger.info('shutting down');
    await engine.stop();
    await withdrawalWorker.stop();
    await notificationsWorker.stop();
    await spotStopWorker.stop();
    await futuresMarkLoop.stop();
    await futuresFundingLoop.stop();
    await marketMaker.stop();
    await binanceConfirmWatcher?.stop();
    await binanceDepositReconciler?.stop();
    binanceHealth?.stop();
    ws.close();
    server.close();
    await pool.end();
    await closeSentry();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT',  shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
