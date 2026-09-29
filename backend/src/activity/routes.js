import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { logUserActivity } from './log.js';
import { classifyIssue } from './classify.js';
import { logSitePageview, normalizeVisitorId } from './views.js';

const PRODUCTS = ['swap', 'spot', 'futures', 'predict', 'xstocks', 'wallet', 'auth', 'markets', 'system', 'other'];

const logSchema = z.object({
  product: z.enum(PRODUCTS),
  action: z.string().trim().min(1).max(64),
  detail: z.record(z.unknown()).optional(),
  tx_hash: z.string().trim().max(128).optional(),
  amount: z.number().finite().optional(),
  asset: z.string().trim().max(32).optional(),
  status: z.string().trim().max(32).optional(),
  /** Wallet-first DEX swaps often complete before SIWE — allow attributing the row. */
  wallet: z.string().trim().max(64).optional(),
}).strict();

const logLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limited' },
  validate: { trustProxy: false },
});

const issueSchema = z.object({
  product: z.enum(PRODUCTS),
  action: z.string().trim().min(1).max(64),
  message: z.string().trim().max(800).optional(),
  code: z.union([z.string(), z.number()]).optional(),
  detail: z.record(z.unknown()).optional(),
  page: z.string().trim().max(64).optional(),
  wallet: z.string().trim().max(64).optional(),
}).strict();

const issueLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limited' },
});

const viewLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limited' },
});

const viewSchema = z.object({
  page: z.string().trim().min(1).max(64).optional(),
  visitor_id: z.string().trim().max(64).optional(),
}).strict();

function tryUserFromAuth(req) {
  try {
    const h = req.headers.authorization || '';
    const m = /^Bearer\s+(.+)$/i.exec(h);
    if (!m) return null;
    const payload = jwt.verify(m[1], config.auth.jwtSecret);
    return {
      sub: payload.sub || null,
      addr: payload.addr || payload.wallet || null,
    };
  } catch (_) {
    return null;
  }
}

export default function createActivityRouter({ requireAuth }) {
  const r = express.Router();

  /**
   * Auth preferred. Wallet-only allowed for on-chain swap/spot with tx_hash —
   * Instant Swap often finishes before SIWE, otherwise admin/history stay empty.
   */
  r.post('/log', logLimiter, async (req, res, next) => {
    try {
      const body = logSchema.parse(req.body || {});
      const authed = tryUserFromAuth(req);
      const wallet = (authed?.addr || body.wallet || '').toLowerCase() || null;
      if (!authed?.sub) {
        const okGuest = (body.product === 'swap' || body.product === 'spot' || body.product === 'futures')
          && !!body.tx_hash
          && !!wallet
          && /^0x[a-f0-9]{40}$/i.test(wallet);
        if (!okGuest) {
          return res.status(401).json({ error: 'unauthorized' });
        }
      }
      await logUserActivity({
        userId: authed?.sub || null,
        wallet,
        product: body.product,
        action: body.action,
        detail: body.detail,
        txHash: body.tx_hash,
        amount: body.amount,
        asset: body.asset,
        status: body.status,
      });
      res.json({ ok: true });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  /** Public pageview ping — powers admin "visits 24h" KPI. Auth optional. */
  r.post('/view', viewLimiter, async (req, res, next) => {
    try {
      const body = viewSchema.parse(req.body || {});
      const page = String(body.page || 'unknown').trim();
      if (page === 'backoffice' || page === 'admin') {
        return res.json({ ok: true, ignored: 'admin_page' });
      }
      const authed = tryUserFromAuth(req);
      const visitorKey = normalizeVisitorId(body.visitor_id);
      await logSitePageview({
        visitorKey,
        page,
        userId: authed?.sub || null,
        wallet: authed?.addr || null,
      });
      res.json({ ok: true, visitor_id: visitorKey });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  /**
   * Client failure report for admin AI monitor.
   * Auth optional — wallet connect / SIWE often fails before JWT exists.
   */
  r.post('/issue', issueLimiter, async (req, res, next) => {
    try {
      const body = issueSchema.parse(req.body || {});
      // Drop mild long-task noise from stale clients (threshold was ~200ms).
      if (body.action === 'ui_lag') {
        const ms = Number(body.detail?.ms);
        const page = String(body.page || body.detail?.page || '');
        if (page === 'backoffice' || page === 'admin') {
          return res.json({ ok: true, ignored: 'admin_page' });
        }
        if (Number.isFinite(ms) && ms < 2500) {
          return res.json({ ok: true, ignored: 'mild_ui_lag' });
        }
        if (/Long task\s+(\d+)/i.test(body.message || '')) {
          const m = Number(RegExp.$1);
          if (Number.isFinite(m) && m < 2500) {
            return res.json({ ok: true, ignored: 'mild_ui_lag' });
          }
        }
      }
      const authed = tryUserFromAuth(req);
      const wallet = (authed?.addr || body.wallet || '').toLowerCase() || null;
      const classified = classifyIssue({
        product: body.product,
        action: body.action,
        message: body.message,
        code: body.code,
        detail: body.detail,
      });
      const detail = {
        ...(body.detail && typeof body.detail === 'object' ? body.detail : {}),
        message: body.message || undefined,
        code: body.code != null ? body.code : undefined,
        page: body.page || undefined,
        cause: classified.cause,
        ai_summary: classified.ai_summary,
        severity: classified.severity,
        ua: String(req.headers['user-agent'] || '').slice(0, 180),
        reported_at: new Date().toISOString(),
      };
      await logUserActivity({
        userId: authed?.sub || null,
        wallet,
        product: body.product,
        action: body.action,
        detail,
        status: 'error',
      });
      res.json({ ok: true, cause: classified.cause, ai_summary: classified.ai_summary });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  return r;
}
