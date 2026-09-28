/**
 * Hyperliquid Builder Codes — public config + CORS-safe proxy.
 * Mounted at /api/futures/hl
 *
 * Orders are signed in the browser; this proxy only forwards info/exchange
 * payloads and exposes GROM's builder address + fee (safe to publish).
 *
 * Read-only info responses are short-cached to avoid HL IP rate-limits (429)
 * when Markets/Trade + health pulse share the droplet egress IP.
 */
import express from 'express';
import axios from 'axios';
import config from '../config/index.js';

const HL_API = 'https://api.hyperliquid.xyz';
const HL_TESTNET_API = 'https://api.hyperliquid-testnet.xyz';

const INFO_CACHE_TTL_MS = 90_000;
/** allMids must stay hot — 90s cache freezes HIP-3 chart tips until hard refresh. */
const MIDS_CACHE_TTL_MS = 2_000;
/** Candles are the heaviest chart traffic; 30s keeps the last bar fresh enough. */
const CANDLE_CACHE_TTL_MS = 30_000;
const INFO_CACHE_MAX_ENTRIES = 800;
const infoCache = new Map(); // key -> { at, status, data }

function infoCacheTtlMs(type) {
  const t = String(type || '');
  if (t === 'allMids') return MIDS_CACHE_TTL_MS;
  if (t === 'candleSnapshot') return CANDLE_CACHE_TTL_MS;
  return INFO_CACHE_TTL_MS;
}

function infoCacheSet(key, entry) {
  infoCache.set(key, entry);
  /* Hundreds of coins × intervals would grow unbounded otherwise. */
  while (infoCache.size > INFO_CACHE_MAX_ENTRIES) {
    const oldest = infoCache.keys().next();
    if (oldest.done) break;
    infoCache.delete(oldest.value);
  }
}

function hlBase() {
  return config.hyperliquid?.testnet ? HL_TESTNET_API : HL_API;
}

function infoCacheKey(body) {
  try {
    const t = body && body.type != null ? String(body.type) : '';
    // Cache only anonymous/public catalog calls — never user clearinghouse/state.
    const cacheable = new Set([
      'meta', 'metaAndAssetCtxs', 'perpDexs', 'allMids', 'spotMeta', 'spotMetaAndAssetCtxs',
      'candleSnapshot',
    ]);
    if (!cacheable.has(t)) return null;
    if (t === 'candleSnapshot') {
      const q = body.req || {};
      /* Requests differ only by a drifting endTime — bucket the window so every
       * user and every pair switch shares one upstream call (HL rate-limits by IP). */
      const startBucket = Math.floor((Number(q.startTime) || 0) / 3_600_000);
      return 'candleSnapshot|' + String(q.coin || '') + '|' + String(q.interval || '') + '|' + startBucket;
    }
    const dex = body.dex != null ? String(body.dex) : '';
    return t + '|' + dex;
  } catch (_) {
    return null;
  }
}

export function createHlFuturesRouter() {
  const r = express.Router();

  r.get('/config', (_req, res) => {
    const builder = String(config.hyperliquid?.builderAddress || process.env.GROM_HL_BUILDER_ADDRESS || '').trim();
    const feeTenthsBp = Number(config.hyperliquid?.builderFeeTenthsBp ?? process.env.GROM_HL_BUILDER_FEE_TENTHS_BP ?? 50);
    // 50 tenths-of-bp = 5 bp = 0.05%
    const enabled = /^0x[a-fA-F0-9]{40}$/.test(builder) && feeTenthsBp > 0 && feeTenthsBp <= 100;
    res.json({
      enabled,
      builder: enabled ? builder : '',
      /** Builder fee charged per order fill, in tenths of a basis point (50 = 0.05%). */
      builderFeeTenthsBp: enabled ? feeTenthsBp : 0,
      builderFeePct: enabled ? feeTenthsBp / 1000 : 0,
      /** Ask user to approve at least this max (recommend 0.1% headroom). */
      maxApproveFeePct: String(config.hyperliquid?.maxApproveFeePct || '0.1%'),
      testnet: !!config.hyperliquid?.testnet,
      apiHost: '/api/futures/hl',
      docs: 'https://hyperliquid.gitbook.io/hyperliquid-docs/trading/builder-codes',
      note: 'Non-custodial · stakes & margin live on Hyperliquid · GROM earns builder fee only',
    });
  });

  // Proxy Info API (meta, allMids, clearinghouseState, …)
  r.post('/info', async (req, res) => {
    try {
      const body = req.body ?? {};
      const key = infoCacheKey(body);
      if (key) {
        const hit = infoCache.get(key);
        const ttl = infoCacheTtlMs(body && body.type);
        if (hit && (Date.now() - hit.at) < ttl && hit.status < 400) {
          return res.status(hit.status)
            .set('cache-control', body?.type === 'allMids' ? 'public, max-age=1' : 'public, max-age=15')
            .set('x-grom-hl-cache', 'hit')
            .json(hit.data);
        }
      }

      const upstream = await axios.post(hlBase() + '/info', body, {
        timeout: 20000,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        validateStatus: () => true,
      });

      // On 429, serve last good cache if present (better than empty Markets).
      if (upstream.status === 429 && key) {
        const stale = infoCache.get(key);
        if (stale && stale.status < 400) {
          return res.status(200)
            .set('cache-control', 'public, max-age=5')
            .set('x-grom-hl-cache', 'stale-on-429')
            .json(stale.data);
        }
      }

      if (key && upstream.status < 400) {
        infoCacheSet(key, { at: Date.now(), status: upstream.status, data: upstream.data });
      }

      res.status(upstream.status)
        .set('cache-control', key ? 'public, max-age=15' : 'no-store')
        .set('x-grom-hl-cache', 'miss')
        .json(upstream.data);
    } catch (e) {
      res.status(502).json({ error: String(e?.message || e) });
    }
  });

  // Proxy Exchange API (already-signed payloads from the browser SDK)
  r.post('/exchange', async (req, res) => {
    try {
      const upstream = await axios.post(hlBase() + '/exchange', req.body ?? {}, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        validateStatus: () => true,
      });
      res.status(upstream.status).set('cache-control', 'no-store').json(upstream.data);
    } catch (e) {
      res.status(502).json({ error: String(e?.message || e) });
    }
  });

  return r;
}

export default createHlFuturesRouter;
