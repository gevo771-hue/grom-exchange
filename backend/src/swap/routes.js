/**
 * Binance Convert swap proxy.
 *   POST /api/swap/convert/quote   — call /sapi/v1/convert/getQuote
 *   POST /api/swap/convert/accept  — call /sapi/v1/convert/acceptQuote
 *
 * Reuses the same Binance API key already used by the market maker
 * (config.mm.binance.{apiKey, apiSecret}). Funds are held custodially on
 * the GROM-MM Binance account; per-user accounting happens elsewhere.
 *
 * Authenticated. Rate-limited softly via in-memory token bucket per user.
 */
import express from 'express';
import { createHmac } from 'node:crypto';
import config from '../config/index.js';

const REST_URL_BASE = () => (config.mm.binance.useTestnet
  ? 'https://testnet.binance.vision'
  : 'https://api.binance.com');

function sign(query) {
  return createHmac('sha256', config.mm.binance.apiSecret).update(query).digest('hex');
}

async function binanceSigned(path, method, params) {
  const apiKey = config.mm.binance.apiKey;
  if (!apiKey) throw Object.assign(new Error('Binance API key not configured'), { code: 'NO_KEYS' });
  const ts = Date.now();
  const usp = new URLSearchParams({ ...params, timestamp: String(ts), recvWindow: '8000' });
  const signed = `${usp.toString()}&signature=${sign(usp.toString())}`;
  const url = `${REST_URL_BASE()}${path}?${signed}`;
  const r = await fetch(url, { method, headers: { 'X-MBX-APIKEY': apiKey } });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch (_) { body = { raw: text }; }
  if (!r.ok) {
    const err = new Error(body?.msg || `binance ${r.status}`);
    err.status = r.status;
    err.binanceCode = body?.code;
    throw err;
  }
  return body;
}

// Tiny in-memory rate limit: 1 req / sec / user / endpoint
const lastHit = new Map();
function rlOK(userId, kind) {
  const key = `${userId}:${kind}`;
  const now = Date.now();
  const prev = lastHit.get(key) || 0;
  if (now - prev < 1000) return false;
  lastHit.set(key, now);
  return true;
}

export function createSwapRouter({ requireAuth }) {
  const r = express.Router();

  // POST /api/swap/convert/quote  { from, to, fromAmount }
  r.post('/convert/quote', requireAuth, async (req, res, next) => {
    try {
      const { from, to, fromAmount } = req.body || {};
      if (!from || !to || !fromAmount) return res.status(400).json({ error: 'from, to, fromAmount required' });
      if (from === to) return res.status(400).json({ error: 'same asset' });
      if (!rlOK(req.user.sub, 'quote')) return res.status(429).json({ error: 'slow down' });

      const data = await binanceSigned('/sapi/v1/convert/getQuote', 'POST', {
        fromAsset: String(from).toUpperCase(),
        toAsset:   String(to).toUpperCase(),
        fromAmount: String(fromAmount),
        walletType: 'SPOT',
      });
      // Normalize shape for frontend
      res.json({
        quoteId:   data.quoteId,
        ratio:     data.ratio,
        inverseRatio: data.inverseRatio,
        toAmount:  data.toAmount,
        fromAmount: data.fromAmount,
        validSec:  Math.max(1, Math.floor((data.validTimestamp - Date.now()) / 1000)),
      });
    } catch (err) {
      if (err.code === 'NO_KEYS') return res.status(503).json({ error: 'swap_unavailable', detail: 'Binance API key missing on server' });
      if (err.binanceCode) return res.status(400).json({ error: 'binance_rejected', code: err.binanceCode, msg: err.message });
      next(err);
    }
  });

  // POST /api/swap/convert/accept  { quoteId }
  r.post('/convert/accept', requireAuth, async (req, res, next) => {
    try {
      const { quoteId } = req.body || {};
      if (!quoteId) return res.status(400).json({ error: 'quoteId required' });
      if (!rlOK(req.user.sub, 'accept')) return res.status(429).json({ error: 'slow down' });

      const data = await binanceSigned('/sapi/v1/convert/acceptQuote', 'POST', { quoteId });
      res.json({
        orderId:    data.orderId,
        status:     data.orderStatus,
        createTime: data.createTime,
      });
    } catch (err) {
      if (err.code === 'NO_KEYS') return res.status(503).json({ error: 'swap_unavailable' });
      if (err.binanceCode) return res.status(400).json({ error: 'binance_rejected', code: err.binanceCode, msg: err.message });
      next(err);
    }
  });

  return r;
}

export default createSwapRouter;
