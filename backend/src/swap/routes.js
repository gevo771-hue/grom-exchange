/**
 * Swap router — two modes:
 *
 *   paper (default) — quote uses live Binance PUBLIC ticker mid-price and a
 *     configurable GROM fee (config.swap.feePct). Accept debits/credits the
 *     user's postgres `balances` row atomically. No Binance API key needed,
 *     no Binance Convert call. Safe for multi-user, ideal for smoke tests
 *     and soft-launch before Convert accounting is wired.
 *
 *   live  — proxy /sapi/v1/convert/{getQuote,acceptQuote} on the GROM master
 *     Binance account. Legacy behaviour — kept for the day we run the whole
 *     book against Convert directly.
 *
 * Both modes share:
 *   POST /api/swap/convert/quote   { from, to, fromAmount }
 *   POST /api/swap/convert/accept  { quoteId }
 *
 * Authenticated + per-user rate-limited.
 */
import express from 'express';
import crypto, { createHmac } from 'node:crypto';
import config from '../config/index.js';
import { query, withTx } from '../db/pool.js';

const REST_URL_BASE = () => (config.mm.binance.useTestnet
  ? 'https://testnet.binance.vision'
  : 'https://api.binance.com');

function signQuery(query) {
  return createHmac('sha256', config.mm.binance.apiSecret).update(query).digest('hex');
}

async function binanceSigned(path, method, params) {
  const apiKey = config.mm.binance.apiKey;
  if (!apiKey) throw Object.assign(new Error('Binance API key not configured'), { code: 'NO_KEYS' });
  const ts = Date.now();
  const usp = new URLSearchParams({ ...params, timestamp: String(ts), recvWindow: '8000' });
  const signed = `${usp.toString()}&signature=${signQuery(usp.toString())}`;
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

// Public Binance ticker — no auth. Cache prices for 3 s to avoid burst.
const priceCache = new Map(); // symbol -> { price, at }
async function binancePublicPrice(symbol) {
  const cached = priceCache.get(symbol);
  if (cached && Date.now() - cached.at < 3000) return cached.price;
  const url = `${REST_URL_BASE()}/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`price fetch failed: ${symbol}`);
  const j = await r.json();
  const price = Number(j.price);
  if (!(price > 0)) throw new Error(`bad price: ${symbol}`);
  priceCache.set(symbol, { price, at: Date.now() });
  return price;
}

/**
 * Convert `fromAmount` of FROM into TO using two public tickers via a USDT
 * bridge (BTC → USDT → ETH, etc). Applies GROM fee, returns { toAmount, ratio, priceUsd }.
 */
async function paperPriceQuote(from, to, fromAmount) {
  const F = from.toUpperCase();
  const T = to.toUpperCase();
  const amt = Number(fromAmount);
  if (!(amt > 0)) throw new Error('amount must be > 0');
  if (F === T) throw new Error('same asset');
  const feeMult = 1 - (Number(config.swap.feePct) / 100);
  // 1 unit of asset in USDT
  const px = async (sym) => {
    if (sym === 'USDT') return 1;
    return binancePublicPrice(`${sym}USDT`);
  };
  const [pF, pT] = await Promise.all([px(F), px(T)]);
  const usdIn  = amt * pF;
  const usdMin = Number(config.swap.minUsd);
  const usdMax = Number(config.swap.maxUsd);
  if (usdIn < usdMin) throw Object.assign(new Error(`min ${usdMin} USD`), { userMsg: true });
  if (usdIn > usdMax) throw Object.assign(new Error(`max ${usdMax} USD`), { userMsg: true });
  const usdOut = usdIn * feeMult;
  const toAmount = usdOut / pT;
  const ratio = toAmount / amt;
  return {
    toAmount: Number(toAmount.toFixed(8)),
    ratio:    Number(ratio.toFixed(8)),
    inverseRatio: Number((1 / ratio).toFixed(8)),
    priceUsdFrom: pF,
    priceUsdTo:   pT,
    feePct: Number(config.swap.feePct),
  };
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

// Paper quote store — quoteId -> { userId, from, to, fromAmount, toAmount, expiresAt }
const paperQuotes = new Map();
function gcPaperQuotes() {
  const now = Date.now();
  for (const [id, q] of paperQuotes) if (q.expiresAt < now) paperQuotes.delete(id);
}
setInterval(gcPaperQuotes, 30000).unref?.();

export function createSwapRouter({ requireAuth }) {
  const r = express.Router();

  // POST /api/swap/convert/quote  { from, to, fromAmount }
  r.post('/convert/quote', requireAuth, async (req, res, next) => {
    try {
      const { from, to, fromAmount } = req.body || {};
      if (!from || !to || fromAmount == null) return res.status(400).json({ error: 'from, to, fromAmount required' });
      const amt = Number(fromAmount);
      if (!(amt > 0)) return res.status(400).json({ error: 'fromAmount must be > 0' });
      if (String(from).toUpperCase() === String(to).toUpperCase()) return res.status(400).json({ error: 'same asset' });
      if (!rlOK(req.user.sub, 'quote')) return res.status(429).json({ error: 'slow down' });

      if (config.swap.mode === 'paper') {
        const q = await paperPriceQuote(from, to, amt);
        const ttlMs = Math.max(2, Number(config.swap.quoteTtlSec)) * 1000;
        const quoteId = crypto.randomUUID();
        paperQuotes.set(quoteId, {
          userId: req.user.sub,
          from:   String(from).toUpperCase(),
          to:     String(to).toUpperCase(),
          fromAmount: amt,
          toAmount:   q.toAmount,
          ratio:      q.ratio,
          expiresAt:  Date.now() + ttlMs,
        });
        return res.json({
          quoteId,
          ratio:        q.ratio,
          inverseRatio: q.inverseRatio,
          fromAmount:   amt,
          toAmount:     q.toAmount,
          validSec:     Math.floor(ttlMs / 1000),
          mode:         'paper',
          feePct:       q.feePct,
        });
      }

      // live mode
      const data = await binanceSigned('/sapi/v1/convert/getQuote', 'POST', {
        fromAsset: String(from).toUpperCase(),
        toAsset:   String(to).toUpperCase(),
        fromAmount: String(fromAmount),
        walletType: 'SPOT',
      });
      res.json({
        quoteId:      data.quoteId,
        ratio:        data.ratio,
        inverseRatio: data.inverseRatio,
        toAmount:     data.toAmount,
        fromAmount:   data.fromAmount,
        validSec:     Math.max(1, Math.floor((data.validTimestamp - Date.now()) / 1000)),
        mode:         'live',
      });
    } catch (err) {
      if (err.code === 'NO_KEYS') return res.status(503).json({ error: 'swap_unavailable', detail: 'Binance API key missing on server' });
      if (err.binanceCode) return res.status(400).json({ error: 'binance_rejected', code: err.binanceCode, msg: err.message });
      if (err.userMsg) return res.status(400).json({ error: err.message });
      next(err);
    }
  });

  // POST /api/swap/convert/accept  { quoteId }
  r.post('/convert/accept', requireAuth, async (req, res, next) => {
    try {
      const { quoteId } = req.body || {};
      if (!quoteId) return res.status(400).json({ error: 'quoteId required' });
      if (!rlOK(req.user.sub, 'accept')) return res.status(429).json({ error: 'slow down' });

      if (config.swap.mode === 'paper') {
        const q = paperQuotes.get(quoteId);
        if (!q) return res.status(400).json({ error: 'quote_not_found_or_expired' });
        if (q.userId !== req.user.sub) return res.status(403).json({ error: 'quote belongs to different user' });
        if (q.expiresAt < Date.now()) { paperQuotes.delete(quoteId); return res.status(400).json({ error: 'quote_expired' }); }

        // Atomic: debit FROM, credit TO in a single transaction. Only 'live'
        // mode balances (custodial trading account); on-chain wallets are
        // untouched.
        const orderId = 'gs_' + crypto.randomBytes(6).toString('hex');
        try {
          await withTx(async (tx) => {
            const rDeb = await tx.query(
              `UPDATE balances
                  SET amount = amount - $3, updated_at = NOW()
                WHERE user_id = $1 AND asset = $2 AND mode = 'live' AND amount >= $3`,
              [req.user.sub, q.from, q.fromAmount]
            );
            if (rDeb.rowCount === 0) {
              const err = new Error('insufficient_balance');
              err.code = 'INSUF';
              throw err;
            }
            await tx.query(
              `INSERT INTO balances (user_id, asset, mode, amount, locked, updated_at)
               VALUES ($1, $2, 'live', $3, 0, NOW())
               ON CONFLICT (user_id, asset, mode)
                 DO UPDATE SET amount = balances.amount + EXCLUDED.amount, updated_at = NOW()`,
              [req.user.sub, q.to, q.toAmount]
            );
            // Best-effort log — table may or may not exist; ignore failure so
            // the swap itself doesn't rollback on missing audit column.
            try {
              await tx.query(
                `INSERT INTO wallet_transfers
                   (id, user_id, direction, asset, network, address, tx_hash, amount, fee, status,
                    confirmations, required_confirmations, note, created_at, updated_at)
                 VALUES ($1, $2, 'swap', $3, 'internal', 'grom-swap', $4, $5, 0, 'completed', 1, 1, $6, NOW(), NOW())`,
                [crypto.randomUUID(), req.user.sub, q.from + '→' + q.to, orderId, q.fromAmount, `Paper swap ${q.fromAmount} ${q.from} → ${q.toAmount} ${q.to}`]
              );
            } catch (_) {}
          });
        } catch (err) {
          if (err.code === 'INSUF') return res.status(400).json({ error: 'insufficient_balance', from: q.from, need: q.fromAmount });
          throw err;
        }
        paperQuotes.delete(quoteId);
        return res.json({
          orderId,
          status: 'FILLED',
          createTime: Date.now(),
          mode: 'paper',
          fromAsset: q.from, toAsset: q.to,
          fromAmount: q.fromAmount, toAmount: q.toAmount,
        });
      }

      // live mode
      const data = await binanceSigned('/sapi/v1/convert/acceptQuote', 'POST', { quoteId });
      res.json({
        orderId:    data.orderId,
        status:     data.orderStatus,
        createTime: data.createTime,
        mode:       'live',
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
