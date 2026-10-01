/**
 * GROM Exchange — backend entrypoint.
 *   - Express HTTP (auth, wallet, markets, metrics)
 *   - WebSocket (live prices)
 *   - Price aggregator (leader worker only)
 */
import http from 'node:http';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import config from './config/index.js';
import logger from './utils/logger.js';
import { metrics, registry } from './utils/metrics.js';
import { pool } from './db/pool.js';
import { closeRedis } from './utils/redis.js';

import createAuthRouter, { requireAuth } from './wallet/siwe.js';
import createWalletRouter from './wallet/routes.js';
import createWsBroadcaster from './ws/broadcaster.js';
import createMarketRouter from './market/routes.js';
import createHlFuturesRouter from './futures/hl-routes.js';
import createAdminRouter from './admin/routes.js';
import createActivityRouter from './activity/routes.js';
import createReferralRouter from './referral/routes.js';
import createDimensionsRouter from './dimensions/routes.js';
import { startHealthPulse, getHealthSnapshot } from './activity/health-pulse.js';
import createAiRouter from './ai/routes.js';
import {
  jupiterEnabled,
  jupiterFeeEnabled,
  jupiterFeeReady,
  jupFeeModeFromConfig,
  jupFeeBpsFromConfig,
} from './wallet/jup-fee.js';
import { createOdosRouter } from './liquidity/odos-routes.js';
import { walletConnectProjectIdForClient } from './wallet/public-config.js';

import CoinGeckoSource from './liquidity/coingecko.js';
import DefiLlamaSource from './liquidity/defillama.js';
import PriceAggregator from './liquidity/price-aggregator.js';
import DexAggregator from './liquidity/dex-aggregator.js';

/** pm2 cluster sets NODE_APP_INSTANCE (0..n-1). Single-process dev = leader. */
const isLeader = !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0';

const corsMw = (req, res, next) => {
  res.header('Access-Control-Allow-Origin', config.cors.origin);
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
};

async function main() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(corsMw);
  const { captureRawBody } = await import('./utils/webhook-sig.js');
  app.use(express.json({
    limit: '256kb',
    verify: captureRawBody,
  }));

  app.use((req, res, next) => {
    res.on('finish', () => {
      metrics.httpRequests.inc({ method: req.method, route: req.route?.path || req.path, status: res.statusCode });
    });
    next();
  });

  const assets = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'BNB/USDT'];
  const coingecko = new CoinGeckoSource({ assets });
  const defillama = new DefiLlamaSource({ assets });
  const priceAggregator = new PriceAggregator([coingecko, defillama]);
  const dex = new DexAggregator();

  const server = http.createServer(app);
  const ws = await createWsBroadcaster(server);
  if (isLeader) {
    logger.info({ worker: process.env.NODE_APP_INSTANCE ?? 'solo' }, 'cluster leader — starting price feed');
    await priceAggregator.start();

    const throttle = new Map();
    for (const src of [coingecko, defillama]) {
      src.on('tick', ({ asset, price, ts }) => {
        const now = Date.now();
        if ((throttle.get(asset) || 0) + 200 > now) return;
        throttle.set(asset, now);
        ws.broadcast(`price:${asset}`, { asset, price, ts, source: src.name });
      });
    }
  } else {
    logger.info({ worker: process.env.NODE_APP_INSTANCE }, 'cluster worker — HTTP/WS (scheduler on leader)');
  }

  app.get('/api/config', (_req, res) => {
    res.json({
      assets,
      devLogin: Boolean(config.allowDevLogin),
    });
  });

  app.get('/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({
        status: 'ok',
        env: config.env,
        worker: process.env.NODE_APP_INSTANCE ?? 'solo',
        leader: isLeader,
        price_sources: isLeader ? priceAggregator.health() : { leader: false },
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

  app.use('/auth',   createAuthRouter());
  app.use('/api', createWalletRouter({ requireAuth, priceAggregator, wsBroadcaster: ws }));
  app.use('/api', createReferralRouter({ requireAuth }));
  app.use('/api/market', createMarketRouter());
  app.use('/api/futures/hl', createHlFuturesRouter());
  app.use('/api/ai', createAiRouter({ requireAuth }));
  app.use('/api/activity', createActivityRouter({ requireAuth }));
  app.use('/api', createDimensionsRouter({ requireAuth }));
  app.use('/api/admin', createAdminRouter({ requireAuth, getHealthSnapshot }));

  let stopHealthPulse = () => {};
  if (isLeader) {
    stopHealthPulse = startHealthPulse({ priceAggregator, isLeader: true }) || (() => {});
  }
  /** Legacy backoffice risk save — PUT /api/settings */
  app.put('/api/settings', requireAuth, async (req, res, next) => {
    try {
      if (req.user?.role !== 'admin') return res.status(403).json({ error: 'admin_required' });
      const { query: dbQuery } = await import('./db/pool.js');
      const { logAdminAudit, clientIp } = await import('./admin/audit.js');
      const cur = await dbQuery(`SELECT value FROM admin_settings WHERE key='risk'`);
      const risk = { ...(cur.rows[0]?.value || {}), ...(req.body?.risk || req.body || {}) };
      await dbQuery(
        `INSERT INTO admin_settings (key, value, updated_at, updated_by) VALUES ('risk',$1::jsonb,NOW(),$2)
         ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW(), updated_by=EXCLUDED.updated_by`,
        [JSON.stringify(risk), req.user.sub]
      );
      await logAdminAudit({ actorId: req.user.sub, action: 'risk_config_save', ip: clientIp(req), metadata: risk });
      res.json({ risk });
    } catch (err) { next(err); }
  });

  app.post('/api/swap/quote', requireAuth, async (req, res, next) => {
    try {
      const { chainId, src, dst, amount, userAddress } = req.body || {};
      if (!chainId || !src || !dst || !amount) return res.status(400).json({ error: 'bad params' });
      const quote = await dex.quote({ chainId, src, dst, amount, userAddress });
      res.json(quote);
    } catch (err) { next(err); }
  });

  const quoteLimiter = rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
  });

  /** Public client config — fee settings and non-secret integration ids only. */
  app.get('/api/swap/public-config', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    const liq = config.liquidity || {};
    let feeBps = Number(liq.feeBps);
    if (!(feeBps === 20)) feeBps = 20; // only publish mandated Instant Swap fee
    const feeReceiver = String(liq.feeReceiver || '').toLowerCase();
    const recvOk = /^0x[a-f0-9]{40}$/.test(feeReceiver);
    const lifiKeyOk = !!String(liq.lifiApiKey || '').trim();
    const squidIntegratorId = String(liq.squidIntegratorId || '').trim();
    const squidFeeBps = Number(liq.squidFeeBps);
    const squidFeeOk = squidFeeBps === 45;
    const squidOk = !!(squidIntegratorId && squidIntegratorId !== 'test-sdk' && squidIntegratorId.length >= 4 && squidFeeOk);
    const odosReferralCode = Number(liq.odosReferralCode) || 0;
    const odosOk = odosReferralCode > 0 && Number.isFinite(odosReferralCode);
    const jupCfg = { liquidity: liq };
    const jupMode = jupFeeModeFromConfig(jupCfg);
    const jupOk = jupiterEnabled(jupCfg);
    const jupFeeOn = jupiterFeeEnabled(jupCfg);
    const jupFeeBps = jupOk ? jupFeeBpsFromConfig(jupCfg) : 0;
    const jupAccountsOk = jupiterFeeReady(jupCfg);
    res.json({
      walletConnectProjectId: walletConnectProjectIdForClient(config.wallet?.walletConnectProjectId),
      feeBps,
      feeReceiver: recvOk ? feeReceiver : null,
      squidIntegratorId: squidOk ? squidIntegratorId : null,
      squidFeeBps: squidOk ? squidFeeBps : null,
      odosReferralCode: odosOk ? Math.floor(odosReferralCode) : null,
      /* Never publish fee account / mint map — backend selects per mint. */
      jupiterFeeAccountsConfigured: jupAccountsOk,
      jupiterFeeMode: jupMode,
      jupiterFeeEnabled: jupFeeOn,
      jupiterFeeBps: jupFeeBps,
      aggregators: {
        paraswap: recvOk,
        kyber: recvOk,
        lifi: lifiKeyOk && recvOk,
        squid: squidOk && recvOk,
        odos: odosOk,
        jupiter: jupOk,
      },
    });
  });

  /** Cached LiFi on-chain quotes for Instant Swap (public read-only). */
  app.post('/api/swap/oc-quote', quoteLimiter, async (req, res, next) => {
    try {
      if (!String(config.liquidity?.lifiApiKey || '').trim()) {
        return res.status(503).json({ error: 'LI.FI route unavailable', code: 'lifi_unavailable' });
      }
      const { fetchLifiOcQuote } = await import('./liquidity/lifi-proxy.js');
      const quote = await fetchLifiOcQuote(req.body || {});
      res.json(quote);
    } catch (err) {
      const status = Number(err.status) || 0;
      if (status === 400 || status === 422) {
        return res.status(status).json({ error: err.message, code: err.code || 'bad_request' });
      }
      if (status === 404) {
        return res.status(404).json({
          error: err.message || 'no route',
          code: err.code || 'no_route',
          upstream: err.upstream || undefined,
        });
      }
      if (status === 409) {
        return res.status(409).json({ error: err.message, code: err.code || 'quote_context_mismatch', details: err.details });
      }
      if (status === 429) {
        res.setHeader('Retry-After', '8');
        return res.status(429).json({ error: 'quote rate limited — retry shortly' });
      }
      if (status === 502 || status === 504) {
        return res.status(status).json({ error: err.message || 'upstream error' });
      }
      next(err);
    }
  });

  /** Odos SOR proxy — production router (server forces referralCode). */
  app.use('/api/swap', createOdosRouter({ config, quoteLimiter }));

  app.use((err, _req, res, _next) => {
    logger.error({ err: err.stack || err.message }, 'unhandled');
    res.status(500).json({ error: 'internal' });
  });

  server.listen(config.ports.backend, () => {
    logger.info({
      port: config.ports.backend,
      worker: process.env.NODE_APP_INSTANCE ?? 'solo',
      leader: isLeader,
      dbPoolMax: config.db.max,
    }, 'GROM backend listening');
  });

  const shutdown = async () => {
    logger.info('shutting down');
    try { stopHealthPulse(); } catch (_) {}
    if (isLeader) {
      for (const s of [coingecko, defillama]) {
        try { await s.stop?.(); } catch {}
      }
    }
    ws.close();
    server.close();
    await closeRedis();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT',  shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
